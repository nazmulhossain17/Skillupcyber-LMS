import { cn } from "@/lib/utils";
import { CloudUploadIcon, ImageIcon } from "lucide-react";
import { Button } from "../ui/button";

export function RenderEmptyState({isDragActive}: {isDragActive: boolean}) {
    return (
        <div className="text-center">
            <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
                <CloudUploadIcon className={cn(
                    'size-6 text-muted-foreground',
                    isDragActive && 'text-primary'
                )}/>
            </div>
            <p className="text-base font-semibold text-foreground">Drop files here or <span className="text-primary font-bold cursor-pointer">click to upload</span></p>
                <Button variant="outline" className="mt-4">Select a file</Button>
        </div>
    )
}


export function RenderErrorState() {
    return (
        <div className="text-destructive text-center">
            <ImageIcon className="size-10 mx-auto mb-3"/>
        </div>
    )
}