import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { helpSections } from "@/lib/datas/help-section";

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-16 h-fit p-16">
      <div className="flex flex-col gap-4 text-center">
        <p className="heading-1">Pusat Bantuan</p>
        <p className="body-medium-regular">
          Jika anda memiliki masalah lain, anda dapat menghubungi{" "}
          <span className="body-medium-bold hover:underline">
            <Link href={"mailto:ariefsatria2409@gmail.com"} target="_blank">
              email kami
            </Link>
          </span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {helpSections.map((sectionData) => (
          <div key={sectionData.id}>
            <p className="heading-2">{sectionData.heading}</p>
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
