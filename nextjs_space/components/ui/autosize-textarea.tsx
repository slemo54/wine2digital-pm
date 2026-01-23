import * as React from "react"
import { cn } from "@/lib/utils"

export interface AutosizeTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const AutosizeTextarea = React.forwardRef<HTMLTextAreaElement, AutosizeTextareaProps>(
    ({ className, value, onChange, ...props }, ref) => {
        const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
        const [content, setContent] = React.useState(value || "")

        // Merge refs
        React.useImperativeHandle(ref, () => textareaRef.current!)

        // Auto-resize logic
        React.useEffect(() => {
            const textarea = textareaRef.current
            if (textarea) {
                textarea.style.height = "auto"
                textarea.style.height = `${textarea.scrollHeight}px`
            }
        }, [content, value])

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value)
            onChange?.(e)
        }

        return (
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                className={cn(
                    "flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden",
                    className
                )}
                rows={1}
                {...props}
            />
        )
    }
)
AutosizeTextarea.displayName = "AutosizeTextarea"
