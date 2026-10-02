import type { Metadata } from "next";
import { Board } from "@/components/Board";

export const metadata: Metadata = { title: "Retro board" };

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Board boardId={id} />;
}
