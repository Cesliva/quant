import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "default";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles = "rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-200 shadow-lg hover:shadow-xl active:scale-[0.98]",
      secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-200 shadow-sm hover:shadow-md active:scale-[0.98]",
      outline: "border-2 border-blue-600 text-blue-600 bg-white hover:bg-blue-50 focus:ring-blue-200 shadow-sm hover:shadow-md active:scale-[0.98]",
      ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-200 active:scale-[0.98]",
      default: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-200 shadow-lg hover:shadow-xl active:scale-[0.98]",
    };
    
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2.5 text-base",
      lg: "px-6 py-3.5 text-lg",
      icon: "p-2",
    };
    
    return (
      <button
        className={cn(baseStyles, variants[variant || "primary"], sizes[size || "md"], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;

