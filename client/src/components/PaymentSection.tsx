import { motion } from "framer-motion";

interface PaymentSectionProps {
  totalAmount: number;
  insurerName: string;
}

export default function PaymentSection({ totalAmount, insurerName }: PaymentSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm mx-auto mt-3 mb-2"
      data-testid="payment-section"
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-foreground" data-testid="text-payment-total-label">
          Total (1 item)
        </span>
        <span className="text-sm font-semibold text-foreground" data-testid="text-payment-total-amount">
          £{totalAmount.toFixed(2)}
        </span>
      </div>

      <div 
        className="bg-zinc-900 rounded-lg p-4 flex items-center justify-center gap-3"
        data-testid="payment-method-box"
      >
        <div className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-8 h-8" aria-label="Google Pay">
            <path fill="#4285F4" d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
          </svg>
          <span className="text-white font-medium text-lg">Pay</span>
        </div>
        
        <div className="w-px h-8 bg-zinc-600" />
        
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-7 bg-orange-500 rounded-md flex items-center justify-center"
            data-testid="payment-card"
          >
            <span className="text-white text-[8px] font-bold">CARD</span>
          </div>
          <span className="text-white font-medium" data-testid="text-card-digits">•••• 9878</span>
        </div>
      </div>

      <div className="mt-3 text-center">
        <button 
          className="text-emerald-600 text-sm font-medium hover:underline cursor-pointer"
          onClick={() => {}}
          data-testid="button-change-payment"
        >
          Add or change payment method &gt;
        </button>
      </div>

      <div className="flex justify-center items-center gap-4 mt-3">
        <svg viewBox="0 0 48 48" className="w-10 h-6" aria-label="Visa">
          <path fill="#1A1F71" d="M44 0H4C1.8 0 0 1.8 0 4v40c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V4c0-2.2-1.8-4-4-4z"/>
          <path fill="#FFFFFF" d="M19 33l2-13h3l-2 13h-3zm14-13c-1 0-2 .3-2 .3l.5 2s.7-.3 1.5-.3c.8 0 1 .4 1 .7v.3h-1c-2 0-3 1-3 3 0 1.5 1 2.5 2.5 2.5 1 0 1.5-.5 1.8-.5l.2.5h2.5l-1-6c-.3-1.5-1.5-2.5-3-2.5zm1 6c0 .5-.5 1.5-1.5 1.5-.5 0-1-.3-1-.8 0-.8.5-1.2 1.5-1.2h1v.5zm-8-6l-1.5 9-.5-2.5-1.5-5s-.3-1.5-2-1.5h-4l-.1.3s2 .4 3.5 1.7l2.6 10h3l5-12h-3.5z"/>
        </svg>
        
        <svg viewBox="0 0 48 48" className="w-10 h-6" aria-label="Mastercard">
          <circle cx="19" cy="24" r="12" fill="#EB001B"/>
          <circle cx="29" cy="24" r="12" fill="#F79E1B"/>
          <path fill="#FF5F00" d="M24 14c3 2.5 5 6 5 10s-2 7.5-5 10c-3-2.5-5-6-5-10s2-7.5 5-10z"/>
        </svg>
        
        <svg viewBox="0 0 48 48" className="w-10 h-6" aria-label="PayPal">
          <path fill="#003087" d="M16 36h-4l3-18h5c3 0 5 2 5 5 0 4-3 7-7 7h-1l-1 6zm3-10h1c2 0 3-1 3-3s-1-2-2-2h-1l-1 5z"/>
          <path fill="#0070E0" d="M26 36h-4l3-18h5c3 0 5 2 5 5 0 4-3 7-7 7h-1l-1 6zm3-10h1c2 0 3-1 3-3s-1-2-2-2h-1l-1 5z"/>
        </svg>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-3" data-testid="text-terms">
        By proceeding you accept our{" "}
        <span className="text-emerald-600 underline cursor-pointer">terms & conditions</span>
        {" "}and AutoAnnie's conditions of cover
      </p>
    </motion.div>
  );
}
