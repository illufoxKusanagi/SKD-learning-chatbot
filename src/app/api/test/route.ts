import { DynamicEmbeddingCacheHelper } from "@/lib/services/ai/dynamic-embedding-cache.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both test format and chat format
    let query: string;

    if (body.query) {
      query = body.query;
    } else if (body.message && body.message.content) {
      query = body.message.content;
    } else {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (!query.trim()) {
      return NextResponse.json(
        { error: "Query cannot be empty" },
        { status: 400 }
      );
    }

    console.log("Testing external search for:", query);

    const cacheHelper = new DynamicEmbeddingCacheHelper();
    const results = await cacheHelper.search(query, 5);

    const responseContent =
      results.length > 0
        ? `Ditemukan ${results.length} hasil relevan:\n\n${results
            .map(
              (r, i) =>
                `${i + 1}. ${r.content} ${
                  r.source ? `*(Sumber: ${r.source})*` : ""
                }`
            )
            .join("\n\n")}`
        : "Maaf, tidak ditemukan informasi yang relevan.";

    return NextResponse.json({
      query,
      results,
      count: results.length,
      content: responseContent,
      message: "External search completed successfully!",
    });
  } catch (error) {
    console.error("External search test failed:", error);
    return NextResponse.json(
      { error: `External search test failed: ${error}` },
      { status: 500 }
    );
  }
}
