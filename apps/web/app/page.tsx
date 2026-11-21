"use client";

import { useId, useState } from "react";
import styles from "./page.module.css";

interface AskResponse {
  question: string;
  answer: string;
  sources: Array<{
    articleNumber: string;
    articleTitle: string | null;
    part: string | null;
    partTitle: string | null;
    chapter: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    chunkIndex: number;
    similarity: number;
  }>;
}

interface ChatTurn {
  id: string;
  question: string;
  answer: string | null;
  sources: AskResponse["sources"];
  error: string | null;
  isLoading: boolean;
}

const exampleQuestions = [
  "What does Article 21 say about personal liberty?",
  "What are the fundamental duties?",
  "What power does the President have to grant pardons?",
];

export default function Home() {
  const questionId = useId();
  const errorId = useId();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasConversation = turns.length > 0;
  const canSubmit = question.trim().length > 0 && !isLoading;

  async function askQuestion(nextQuestion = question, existingTurnId?: string) {
    const normalizedQuestion = nextQuestion.trim();

    if (!normalizedQuestion) {
      setInputError("Type a question before asking.");
      return;
    }

    const turnId = existingTurnId ?? createTurnId();

    setIsLoading(true);
    setInputError(null);

    if (existingTurnId) {
      setTurns((currentTurns) =>
        currentTurns.map((turn) =>
          turn.id === existingTurnId
            ? {
                ...turn,
                answer: null,
                sources: [],
                error: null,
                isLoading: true,
              }
            : turn,
        ),
      );
    } else {
      setTurns((currentTurns) => [
        ...currentTurns,
        {
          id: turnId,
          question: normalizedQuestion,
          answer: null,
          sources: [],
          error: null,
          isLoading: true,
        },
      ]);
      setQuestion("");
    }

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: normalizedQuestion,
        }),
      });

      if (!response.ok) {
        throw new Error("The answer service failed. Try again in a moment.");
      }

      const data = (await response.json()) as AskResponse;
      setTurns((currentTurns) =>
        currentTurns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                answer: data.answer,
                sources: data.sources,
                error: null,
                isLoading: false,
              }
            : turn,
        ),
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Something went wrong. Try again.";

      setTurns((currentTurns) =>
        currentTurns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                answer: null,
                sources: [],
                error: message,
                isLoading: false,
              }
            : turn,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion();
  }

  function handleExampleClick(example: string) {
    setQuestion(example);
    void askQuestion(example);
  }

  const composer = (
    <form
      className={`${styles.composer} ${hasConversation ? styles.composerFollowUp : ""}`}
      onSubmit={handleSubmit}
    >
      <label className={styles.visuallyHidden} htmlFor={questionId}>
        Ask a constitutional law question
      </label>
      <textarea
        id={questionId}
        className={styles.textarea}
        value={question}
        rows={1}
        spellCheck
        aria-invalid={inputError ? "true" : undefined}
        aria-describedby={inputError ? errorId : undefined}
        placeholder={hasConversation ? "Ask a follow-up…" : "Message Law RAG…"}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSubmit) void askQuestion();
          }
        }}
      />

      <div className={styles.composerFooter}>
        <button
          className={styles.sendButton}
          type="submit"
          disabled={!canSubmit}
          aria-busy={isLoading}
          aria-label={isLoading ? "Generating answer" : "Ask question"}
        >
          {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : "↑"}
        </button>
      </div>
    </form>
  );

  return (
    <main className={`${styles.page} ${hasConversation ? styles.pageChatMode : ""}`}>
      {!hasConversation ? (
        <section className={styles.centerStage} aria-labelledby="page-title">
          <div className={styles.titleBlock}>
            <h1 id="page-title">Ask the Constitution.</h1>
          </div>

          {composer}

          {inputError ? (
            <div id={errorId} className={styles.errorBox} role="alert">
              <span>{inputError}</span>
              <button
                className={styles.retryButton}
                type="button"
                onClick={() => void askQuestion()}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className={styles.examples} aria-label="Example questions">
            {exampleQuestions.map((example) => (
              <button
                key={example}
                className={styles.exampleButton}
                type="button"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.chatLayout} aria-label="Law RAG conversation">
          <div className={styles.chatThread} aria-live="polite">
            {turns.map((turn) => (
              <div className={styles.turn} key={turn.id}>
                <div className={styles.userRow}>
                  <div className={styles.userBubble}>{turn.question}</div>
                </div>

                <div className={styles.assistantRow}>
                  <div className={styles.assistantMark} aria-hidden="true">
                    §
                  </div>
                  <div className={styles.assistantContent}>
                    {turn.isLoading ? <AnswerSkeleton /> : null}

                    {!turn.isLoading && turn.error ? (
                      <div className={styles.errorBox} role="alert">
                        <span>{turn.error}</span>
                        <button
                          className={styles.retryButton}
                          type="button"
                          onClick={() => void askQuestion(turn.question, turn.id)}
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}

                    {!turn.isLoading && turn.answer ? (
                      <article className={styles.answerCard}>
                        <p className={styles.answerText}>{cleanAnswerText(turn.answer)}</p>

                        <div className={styles.sources}>
                          <h2>Sources</h2>
                          <div className={styles.sourceGrid}>
                            {turn.sources.map((source, index) => (
                              <div
                                className={styles.sourceCard}
                                key={`${turn.id}-${source.articleNumber}-${source.chunkIndex}-${index}`}
                              >
                                <div className={styles.sourceTopline}>
                                  <span>Article {source.articleNumber}</span>
                                </div>
                                <p>{source.articleTitle ?? "Untitled"}</p>
                                <small>
                                  {source.part ? `Part ${source.part}` : "Constitution"}
                                  {source.partTitle ? ` · ${source.partTitle}` : ""}
                                  {source.pageStart && source.pageEnd
                                    ? ` · pages ${source.pageStart}-${source.pageEnd}`
                                    : ""}
                                </small>
                              </div>
                            ))}
                          </div>
                        </div>
                      </article>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.followUpComposer}>{composer}</div>
        </section>
      )}
    </main>
  );
}

function AnswerSkeleton() {
  return (
    <div className={styles.skeletonCard} aria-label="Loading answer">
      <div className={styles.skeletonLineLarge} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLineShort} />
    </div>
  );
}

function cleanAnswerText(answer: string) {
  return answer.replace(/\*\*(.*?)\*\*/g, "$1");
}

function createTurnId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
