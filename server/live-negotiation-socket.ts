import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { storage } from "./storage";
import {
  generateNegotiationResponse,
  parseOutcome,
  determineOutcomeCategory,
  type ConversationMessage,
} from "./live-negotiation-agent";
import type { LiveNegotiation } from "@shared/schema";

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initializeLiveNegotiationSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[LiveNego Socket] Client connected: ${socket.id}`);

    socket.on("join_negotiation", async (data: { roomId: string; role: "customer" | "agent" }) => {
      const { roomId, role } = data;
      socket.join(roomId);
      console.log(`[LiveNego Socket] ${role} joined room: ${roomId}`);

      const negotiation = await storage.getLiveNegotiationByRoom(roomId);
      if (!negotiation) return;

      const messages = await storage.getLiveNegotiationMessages(negotiation.id);
      socket.emit("message_history", messages);

      if (role === "agent") {
        if (negotiation.status === "pending") {
          await storage.updateLiveNegotiationStatus(negotiation.id, "active");
          io!.to(roomId).emit("agent_joined", { negotiationId: negotiation.id });

          if (messages.length === 0) {
            await sendAutoAnnieMessage(negotiation, [], true);
          }
        } else {
          socket.emit("agent_joined", { negotiationId: negotiation.id });
        }
      }
    });

    socket.on("agent_message", async (data: { roomId: string; message: string }) => {
      const { roomId, message } = data;

      const negotiation = await storage.getLiveNegotiationByRoom(roomId);
      if (!negotiation) {
        socket.emit("error", { message: "Negotiation not found" });
        return;
      }

      const savedMsg = await storage.createLiveNegotiationMessage({
        negotiation_id: negotiation.id,
        sender: "agent",
        message,
      });

      io!.to(roomId).emit("new_message", savedMsg);

      const allMessages = await storage.getLiveNegotiationMessages(negotiation.id);
      const conversationHistory: ConversationMessage[] = allMessages.map(m => ({
        role: m.sender === "autoannie" ? "model" as const : "user" as const,
        text: m.message,
      }));

      await sendAutoAnnieMessage(negotiation, conversationHistory, false);
    });

    socket.on("customer_decision", async (data: { roomId: string; decision: "stay" | "switch" }) => {
      const { roomId, decision } = data;
      const negotiation = await storage.getLiveNegotiationByRoom(roomId);
      if (!negotiation) return;

      if (decision === "stay") {
        const stayMessage = `Thank you. ${negotiation.customer_name} has decided to stay with ${negotiation.provider_name}. Please confirm the renewal at £${negotiation.final_offer_price?.toFixed(2) || negotiation.current_premium.toFixed(2)}. We appreciate your time.`;
        const savedMsg = await storage.createLiveNegotiationMessage({
          negotiation_id: negotiation.id,
          sender: "autoannie",
          message: stayMessage,
        });
        io!.to(roomId).emit("new_message", savedMsg);
        await storage.updateLiveNegotiationStatus(negotiation.id, "completed");
        io!.to(roomId).emit("negotiation_closed", { decision: "stay" });
      } else {
        const switchMessage = `Thank you for your time. Unfortunately, the offer does not meet ${negotiation.customer_name}'s expectations. The customer has decided to proceed with ${negotiation.competitor_name}. We appreciate the discussion.`;
        const savedMsg = await storage.createLiveNegotiationMessage({
          negotiation_id: negotiation.id,
          sender: "autoannie",
          message: switchMessage,
        });
        io!.to(roomId).emit("new_message", savedMsg);
        await storage.updateLiveNegotiationStatus(negotiation.id, "completed");
        io!.to(roomId).emit("negotiation_closed", { decision: "switch" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[LiveNego Socket] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[LiveNego Socket] Socket.IO server initialized");
  return io;
}

async function sendAutoAnnieMessage(
  negotiation: LiveNegotiation,
  conversationHistory: ConversationMessage[],
  isOpening: boolean
) {
  const roomId = negotiation.socket_room_id;

  io!.to(roomId).emit("autoannie_typing", true);

  try {
    const response = await generateNegotiationResponse(negotiation, conversationHistory, isOpening);

    const cleanResponse = response
      .replace(/\[OUTCOME:(ACCEPTED|REJECTED):£[\d.]+\]/g, "")
      .trim();

    const savedMsg = await storage.createLiveNegotiationMessage({
      negotiation_id: negotiation.id,
      sender: "autoannie",
      message: cleanResponse,
    });

    io!.to(roomId).emit("autoannie_typing", false);
    io!.to(roomId).emit("new_message", savedMsg);

    const outcome = parseOutcome(response);
    if (outcome.type !== null) {
      const category = determineOutcomeCategory(negotiation, outcome);
      await storage.updateLiveNegotiationStatus(
        negotiation.id,
        "awaiting_customer",
        category,
        outcome.price ?? undefined
      );

      io!.to(roomId).emit("negotiation_outcome", {
        negotiationId: negotiation.id,
        outcome: category,
        finalOfferPrice: outcome.price,
        competitorQuote: negotiation.competitor_quote,
        providerName: negotiation.provider_name,
        competitorName: negotiation.competitor_name,
      });
    }
  } catch (error) {
    console.error("[LiveNego Socket] Error generating AA response:", error);
    io!.to(roomId).emit("autoannie_typing", false);
  }
}
