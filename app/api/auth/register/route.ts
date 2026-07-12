import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { normalizeRegistrationInput, validateRegistrationInput } from "@/lib/registration";

export async function POST(request: NextRequest) {
  try {
    const input = normalizeRegistrationInput(await request.json());
    const validation = validateRegistrationInput(input);
    if (validation) return NextResponse.json({ error: validation.error }, { status: validation.status });

    // Check if user exists
    const existingUser = await db.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 409 }
      );
    }

    // Hash password and create user
    const hashedPassword = await hash(input.password, 10);

    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: hashedPassword,
        role: "USER",
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este email já está cadastrado" }, { status: 409 });
    }
    console.error("Error registering user:", error);
    return NextResponse.json(
      { error: "Erro ao registrar usuário" },
      { status: 500 }
    );
  }
}
