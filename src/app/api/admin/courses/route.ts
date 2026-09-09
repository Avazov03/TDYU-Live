import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  titleUz: z.string().trim().min(2),
  descriptionUz: z.string().trim().min(2),
  teacherId: z.string().trim().min(1),
  facultyId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  priceT1: z.number().int().min(0),
  priceT2: z.number().int().min(0),
  priceT3: z.number().int().min(0),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const course = await prisma.course.create({
    data: parsed.data,
  });
  return NextResponse.json({ course }, { status: 201 });
}
