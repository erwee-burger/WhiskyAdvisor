import { NextResponse } from "next/server";

import { createTastingPerson, getTastingPeople } from "@/lib/repository";
import { tastingPersonSchema } from "@/lib/schemas";

export async function GET() {
  const people = await getTastingPeople();
  return NextResponse.json(people);
}

export async function POST(request: Request) {
  try {
    const parsed = tastingPersonSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const person = await createTastingPerson(parsed.data);
    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the person.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
