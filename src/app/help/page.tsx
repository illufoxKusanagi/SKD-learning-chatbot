import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { helpSections } from "@/lib/datas/help-section";

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8 sm:px-8">
      <div className="flex justify-start">
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">
            <ArrowLeft data-icon="inline-start" />
            Kembali ke Chat
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 text-center">
        <h1 className="heading-1">Pusat Bantuan</h1>
        <p className="body-medium-regular text-muted-foreground">
          Jika anda memiliki masalah lain, anda dapat menghubungi{" "}
          <a
            href="mailto:ariefsatria2409@gmail.com"
            className="body-medium-bold text-primary underline underline-offset-4 hover:no-underline"
          >
            email kami
          </a>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {helpSections.map((sectionData) => (
          <div key={sectionData.id} className="flex flex-col gap-2">
            <h2 className="heading-2">{sectionData.heading}</h2>
            <Accordion type="single" collapsible className="w-full">
              {sectionData.items.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger>
                    <span className="body-big-regular">{item.title}</span>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-4 text-balance body-medium-regular">
                    <p>{item.content}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    </div>
  );
}
