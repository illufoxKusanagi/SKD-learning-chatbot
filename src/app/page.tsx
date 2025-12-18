"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import MainContent from "@/components/chat/main-chat-page";
import Link from "next/link";
import HelpButton from "@/components/ui/help-button";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function HomeContent() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  const user = session?.user;

  console.log("Is authenticated in home page: ", isAuthenticated);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // const insertTestRagData = async () => {
  //   setIsDbLoading(true);
  //   setDbStatus("");
  //   try {
  //     const response = await fetch("/api/rag/data", {
  //       method: "POST",
  //     });
  //     const result = await response.json();
  //     if (response.ok) {
  //       setDbStatus("Insert rag datas succesful!");
  //     } else {
  //       console.error("Error inserting data:", result.error);
  //       setDbStatus(`Error: ${result.message}`);
  //     }
  //   } catch (error) {
  //     setDbStatus(`Error: ${(error as Error).message}`);
  //   } finally {
  //     setIsDbLoading(false);
  //   }
  // };

  // Home page should be accessible to everyone - no authentication blocking
  return (
    <div className="flex flex-col h-screen relative">
      <div className="flex gap-4 absolute top-4 right-4 z-10">
        <ModeToggleButton />
        <HelpButton />
        {!isAuthenticated ? (
          <Link href={"/auth/login"}>
            <Button>Login</Button>
          </Link>
        ) : (
          <div className="flex items-center">
            {isLoading ? (
              <p className="body-medium-regular">Loading...</p>
            ) : (
              <p className="body-medium-regular">
                Halo, {user?.name || user?.email}
              </p>
            )}
          </div>
        )}
      </div>
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-row h-full w-full">
          {isAuthenticated && (
            <>
              <AppSidebar />
              <SidebarTrigger className="ml-4 mt-4" size={"xl"} />
            </>
          )}
          <main className="flex-1 overflow-y-auto">
            <MainContent />
          </main>
        </div>
      </SidebarProvider>
      <footer className="flex flex-col w-full items-center absolute h-fit bg-accent p-2 bottom-0">
        <p className="body-small-regular">
          Made with 💗 by{" "}
          <span className="hover:underline">
            <Link
              href={"https://github.com/illufoxKusanagi"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Illufox Kasunagi
            </Link>
          </span>
        </p>
        {/* {dbStatus && <p className="text-sm font-medium">{dbStatus}</p>}
        <Button
          onClick={insertTestRagData}
          disabled={isDbLoading}
          variant="outline"
        >
          <Bubbles size="icon" className="m-2" />
          {isDbLoading ? "Testing..." : "Test Database"}
        </Button> */}
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
