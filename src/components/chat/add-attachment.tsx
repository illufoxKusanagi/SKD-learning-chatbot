import { Plus, Image as ImageIcon, Paperclip } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export default function AddAttachment() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Add attachment">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Add Attachment</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem className="gap-2">
          <ImageIcon />
          Tambahkan gambar
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2">
          <Paperclip />
          Tambahkan dokumen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
