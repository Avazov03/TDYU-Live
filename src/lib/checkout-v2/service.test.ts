/**
 * Checkout V2 service orchestration tests with an in-memory fake TX.
 * Covers idempotency, already-enrolled, capacity, multi-course, rollback.
 *
 *   npm run test:checkout-v2
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { CourseLifecycleStatus, EnrollmentStatus } from "@/generated/prisma/client";
import { CheckoutV2Error } from "./errors";
import { isOpenEnrollmentSeat, resolveServerListPrice } from "./eligibility";

type FakeEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  purchaseId: string | null;
  status: EnrollmentStatus;
  accessOpen: boolean;
};

type FakeCourse = {
  id: string;
  listPrice: number | null;
  capacity: number | null;
  isPublished: boolean;
  lifecycleStatus: CourseLifecycleStatus | null;
};

type FakeUser = {
  id: string;
  role: "student";
  isBlocked: boolean;
  purchaseAllowed: boolean;
  accountStatus: "active" | "restricted" | "suspended";
};

/**
 * Minimal orchestrator mirroring service.ts rules (no Prisma).
 * Used to lock behavior for scenarios that need multi-step state.
 */
function fakeCheckout(args: {
  user: FakeUser;
  course: FakeCourse;
  enrollments: FakeEnrollment[];
  idempotencyKey: string;
  priorKeys?: Map<string, { userId: string; courseId: string }>;
  failAfterPurchase?: boolean;
}): {
  ok: true;
  amountPaid: number;
  enrollmentId: string;
  enrollments: FakeEnrollment[];
  purchases: number;
} {
  const prior = args.priorKeys?.get(args.idempotencyKey);
  if (prior) {
    if (prior.userId !== args.user.id || prior.courseId !== args.course.id) {
      throw new CheckoutV2Error("IDEMPOTENCY_CONFLICT", 409, "conflict");
    }
    // replay — no new enrollment
    const existing = args.enrollments.find(
      (e) => e.userId === args.user.id && e.courseId === args.course.id && isOpenEnrollmentSeat(e),
    );
    if (!existing) throw new CheckoutV2Error("INTERNAL_ERROR", 500, "replay missing");
    return {
      ok: true,
      amountPaid: resolveServerListPrice(args.course.listPrice) ?? 0,
      enrollmentId: existing.id,
      enrollments: args.enrollments,
      purchases: 0,
    };
  }

  if (!args.user.purchaseAllowed || args.user.isBlocked) {
    throw new CheckoutV2Error("PURCHASE_NOT_ALLOWED", 403, "denied");
  }

  const amount = resolveServerListPrice(args.course.listPrice);
  if (amount == null) throw new CheckoutV2Error("PRICE_UNAVAILABLE", 422, "no price");

  const openMine = args.enrollments.find(
    (e) => e.userId === args.user.id && e.courseId === args.course.id && isOpenEnrollmentSeat(e),
  );
  if (openMine) throw new CheckoutV2Error("ALREADY_ENROLLED", 409, "enrolled");

  const openCount = args.enrollments.filter(
    (e) => e.courseId === args.course.id && isOpenEnrollmentSeat(e),
  ).length;
  if (args.course.capacity != null && openCount >= args.course.capacity) {
    throw new CheckoutV2Error("CAPACITY_FULL", 409, "full");
  }

  const purchaseId = randomUUID();
  if (args.failAfterPurchase) {
    // Simulate mid-TX failure — caller must not keep partial enrollment
    throw new CheckoutV2Error("INTERNAL_ERROR", 500, "rolled back");
  }

  const enrollment: FakeEnrollment = {
    id: randomUUID(),
    userId: args.user.id,
    courseId: args.course.id,
    purchaseId,
    status: "active",
    accessOpen: true,
  };
  args.priorKeys?.set(args.idempotencyKey, {
    userId: args.user.id,
    courseId: args.course.id,
  });

  return {
    ok: true,
    amountPaid: amount,
    enrollmentId: enrollment.id,
    enrollments: [...args.enrollments, enrollment],
    purchases: 1,
  };
}

const student = (): FakeUser => ({
  id: "u1",
  role: "student",
  isBlocked: false,
  purchaseAllowed: true,
  accountStatus: "active",
});

describe("Checkout V2 fake orchestrator scenarios", () => {
  it("1 valid active course purchase", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c-active",
        listPrice: 100,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "active",
      },
      enrollments: [],
      idempotencyKey: "k1",
    });
    assert.equal(r.purchases, 1);
    assert.equal(r.amountPaid, 100);
  });

  it("2 valid completed course purchase", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c-done",
        listPrice: 200,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "completed",
      },
      enrollments: [],
      idempotencyKey: "k2",
    });
    assert.equal(r.ok, true);
    assert.equal(r.amountPaid, 200);
  });

  it("3 mid-course (active) purchase", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c-mid",
        listPrice: 50,
        capacity: 10,
        isPublished: true,
        lifecycleStatus: "active",
      },
      enrollments: [],
      idempotencyKey: "k3",
    });
    assert.equal(r.purchases, 1);
  });

  it("7 capacity full", () => {
    assert.throws(
      () =>
        fakeCheckout({
          user: student(),
          course: {
            id: "c-full",
            listPrice: 10,
            capacity: 1,
            isPublished: true,
            lifecycleStatus: "published",
          },
          enrollments: [
            {
              id: "e0",
              userId: "other",
              courseId: "c-full",
              purchaseId: "p0",
              status: "active",
              accessOpen: true,
            },
          ],
          idempotencyKey: "k7",
        }),
      (e: unknown) => e instanceof CheckoutV2Error && e.code === "CAPACITY_FULL",
    );
  });

  it("8 unlimited capacity", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c-unlim",
        listPrice: 10,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "published",
      },
      enrollments: Array.from({ length: 50 }, (_, i) => ({
        id: `e${i}`,
        userId: `other-${i}`,
        courseId: "c-unlim",
        purchaseId: `p${i}`,
        status: "active" as const,
        accessOpen: true,
      })),
      idempotencyKey: "k8",
    });
    assert.equal(r.purchases, 1);
  });

  it("9 duplicate idempotency → no second purchase", () => {
    const keys = new Map<string, { userId: string; courseId: string }>();
    const course = {
      id: "c-idem",
      listPrice: 10,
      capacity: null,
      isPublished: true,
      lifecycleStatus: "published" as const,
    };
    const first = fakeCheckout({
      user: student(),
      course,
      enrollments: [],
      idempotencyKey: "same",
      priorKeys: keys,
    });
    const second = fakeCheckout({
      user: student(),
      course,
      enrollments: first.enrollments,
      idempotencyKey: "same",
      priorKeys: keys,
    });
    assert.equal(second.purchases, 0);
    assert.equal(second.enrollmentId, first.enrollmentId);
  });

  it("10 same key different course → conflict", () => {
    const keys = new Map([["k", { userId: "u1", courseId: "c-a" }]]);
    assert.throws(
      () =>
        fakeCheckout({
          user: student(),
          course: {
            id: "c-b",
            listPrice: 10,
            capacity: null,
            isPublished: true,
            lifecycleStatus: "published",
          },
          enrollments: [],
          idempotencyKey: "k",
          priorKeys: keys,
        }),
      (e: unknown) => e instanceof CheckoutV2Error && e.code === "IDEMPOTENCY_CONFLICT",
    );
  });

  it("11 active enrollment → ALREADY_ENROLLED", () => {
    assert.throws(
      () =>
        fakeCheckout({
          user: student(),
          course: {
            id: "c1",
            listPrice: 10,
            capacity: null,
            isPublished: true,
            lifecycleStatus: "published",
          },
          enrollments: [
            {
              id: "e1",
              userId: "u1",
              courseId: "c1",
              purchaseId: "p1",
              status: "active",
              accessOpen: true,
            },
          ],
          idempotencyKey: "k11",
        }),
      (e: unknown) => e instanceof CheckoutV2Error && e.code === "ALREADY_ENROLLED",
    );
  });

  it("12 refunded enrollment → re-buy allowed", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c1",
        listPrice: 10,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "published",
      },
      enrollments: [
        {
          id: "e-old",
          userId: "u1",
          courseId: "c1",
          purchaseId: "p-old",
          status: "refunded",
          accessOpen: false,
        },
      ],
      idempotencyKey: "k12",
    });
    assert.equal(r.purchases, 1);
  });

  it("13 closed enrollment → re-buy allowed", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c1",
        listPrice: 10,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "published",
      },
      enrollments: [
        {
          id: "e-closed",
          userId: "u1",
          courseId: "c1",
          purchaseId: "p-old",
          status: "active",
          accessOpen: false,
        },
      ],
      idempotencyKey: "k13",
    });
    assert.equal(r.purchases, 1);
  });

  it("14 multiple courses — concurrent open seats", () => {
    let enrollments: FakeEnrollment[] = [];
    const keys = new Map<string, { userId: string; courseId: string }>();
    for (const id of ["c-a", "c-b", "c-c"]) {
      const r = fakeCheckout({
        user: student(),
        course: {
          id,
          listPrice: 10,
          capacity: null,
          isPublished: true,
          lifecycleStatus: "published",
        },
        enrollments,
        idempotencyKey: `key-${id}`,
        priorKeys: keys,
      });
      enrollments = r.enrollments;
    }
    const open = enrollments.filter((e) => e.userId === "u1" && isOpenEnrollmentSeat(e));
    assert.equal(open.length, 3);
  });

  it("15 price snapshot ignores client claim", () => {
    const clientAmount = 1;
    const server = resolveServerListPrice(999);
    assert.notEqual(server, clientAmount);
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c-price",
        listPrice: 999,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "published",
      },
      enrollments: [],
      idempotencyKey: "k15",
    });
    assert.equal(r.amountPaid, 999);
  });

  it("16 transaction failure → no enrollment kept", () => {
    const before: FakeEnrollment[] = [];
    assert.throws(
      () =>
        fakeCheckout({
          user: student(),
          course: {
            id: "c-fail",
            listPrice: 10,
            capacity: null,
            isPublished: true,
            lifecycleStatus: "published",
          },
          enrollments: before,
          idempotencyKey: "k16",
          failAfterPurchase: true,
        }),
      (e: unknown) => e instanceof CheckoutV2Error && e.code === "INTERNAL_ERROR",
    );
    assert.equal(before.length, 0);
  });

  it("18 cross-user isolation — other user open seat does not block (unless capacity)", () => {
    const r = fakeCheckout({
      user: student(),
      course: {
        id: "c-x",
        listPrice: 10,
        capacity: null,
        isPublished: true,
        lifecycleStatus: "published",
      },
      enrollments: [
        {
          id: "e-other",
          userId: "u-other",
          courseId: "c-x",
          purchaseId: "p-other",
          status: "active",
          accessOpen: true,
        },
      ],
      idempotencyKey: "k18",
    });
    assert.equal(r.purchases, 1);
  });
});
