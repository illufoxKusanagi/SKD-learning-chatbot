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
        <Button
          asChild
          variant="outline"
          size="icon"
          aria-label="Bantuan"
        >
          <Link href="/help">
            <CircleQuestionMark aria-hidden />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Bantuan</p>
      </TooltipContent>
    </Tooltip>
  );
}
