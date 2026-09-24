import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { featureFlags } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { resolveServerListPrice } from "@/lib/checkout-v2/eligibility";
import { CheckoutV2Client } from "@/components/course/CheckoutV2Client";
import { isStudentRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ courseId?: string }>;
};

/**
 * Course Checkout V2 page — gated by FF_COURSE_CHECKOUT_V2.
 * Does not use V1 tariff checkout.
 */
export default async function CheckoutV2Page({ searchParams }: Props) {
  if (!featureFlags.courseCheckoutV2) {
    redirect("/#tariflar");
  }

  const session = await auth();
  const sp = await searchParams;
  const courseId = sp.courseId?.trim();
  if (!courseId) {
    redirect("/search");
  }

  const callback = `/checkout/v2?courseId=${encodeURIComponent(courseId)}`;
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`);
  }
  if (!isStudentRole(session.user.role)) {
    redirect("/app");
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      titleUz: true,
      listPrice: true,
      isPublished: true,
      lifecycleStatus: true,
    },
  });
  if (!course) {
    redirect("/search");
  }

  const listPrice = resolveServerListPrice(course.listPrice);
  if (listPrice == null) {
    redirect(`/courses/${courseId}`);
  }

  return (
    <CheckoutV2Client
      courseId={course.id}
      courseTitle={course.titleUz}
      listPrice={listPrice}
    />
  );
}
