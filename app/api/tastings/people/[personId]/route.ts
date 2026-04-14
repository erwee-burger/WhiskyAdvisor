import { NextResponse } from "next/server";

import { deleteTastingPerson, updateTastingPerson } from "@/lib/repository";
import { tastingPersonSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ personId: string }> }
) {
  try {
    const parsed = tastingPersonSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { personId } = await context.params;
    const person = await updateTastingPerson(personId, parsed.data);

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json(person);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the person.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ personId: string }> }
) {
  try {
    const { personId } = await context.params;
    const deleted = await deleteTastingPerson(personId);

    if (!deleted) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the person.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("tasting history") ? 409 : 500 }
    );
  }
}
