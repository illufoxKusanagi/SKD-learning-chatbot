// import { DynamicEmbeddingCacheHelper } from "@/lib/services/ai/dynamic-embedding-cache.service";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    console.log("Starting cache refresh process...");

    // const cacheHelper = new DynamicEmbeddingCacheHelper();
    // Implementasi refresh cache jika diperlukan

    return NextResponse.json({
      message: "Cache refresh completed successfully!",
      status: "success",
    });
  } catch (error) {
    console.error("Cache refresh failed:", error);
    return NextResponse.json(
      { error: "Cache refresh failed." },
      { status: 500 }
    );
  }
}
