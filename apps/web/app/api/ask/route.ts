import { answerQuestion } from "@repo/rag";

export const runtime = "nodejs";

interface AskRequestBody {
  question?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskRequestBody;

    if (typeof body.question !== "string" || !body.question.trim()) {
      return Response.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        },
      );
    }

    const result = await answerQuestion(body.question, {
      limit: 5,
    });

    return Response.json(result);
  } catch (error) {
    console.error("/api/ask failed", error);

    return Response.json(
      {
        error: "Failed to answer question",
      },
      {
        status: 500,
      },
    );
  }
}
