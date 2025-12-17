import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleQuestionMark } from "lucide-react";
import Link from "next/link";
import { Button } from "./button";

export default function HelpButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/help">
          <Button
            variant="outline"
            size="icon"
            className="p-2"
            aria-label="Bantuan"
          >
            <CircleQuestionMark size="icon" aria-hidden />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>Bantuan</p>
      </TooltipContent>
    </Tooltip>
  );
}
