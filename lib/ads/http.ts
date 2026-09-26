import { NextResponse } from "next/server";
import { actorFromRequest } from "./auth";
import type { Actor } from "./types";

export async function requireActor(request: Request): Promise<Actor | NextResponse> {
  const actor = await actorFromRequest(request);
  if (!actor) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401 },
    );
  }
  return actor;
}

export function isActor(value: Actor | NextResponse): value is Actor {
  return !(value instanceof NextResponse);
}
