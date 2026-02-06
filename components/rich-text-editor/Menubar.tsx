import { type Editor } from "@tiptap/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Toggle } from "@/components/ui/toggle"
import { Bold } from "lucide-react";
import { cn } from "@/lib/utils";
interface iAppProps{
    editor: Editor | null;
}

export function Menubar({editor}: iAppProps) {
    if(!editor){
        return null;
    }
    return (
        <div>
            <TooltipProvider>
                <div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle 
                                size="sm"
                                pressed={editor.isActive('bold')} 
                                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                                className={cn(
                                    editor.isActive("bold") && "bg-muted text-muted-foreground"
                                )}
                                > 
                                <Bold/>
                            </Toggle>
                        </TooltipTrigger>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>
    )
}