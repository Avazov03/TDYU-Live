import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { PublicCourseCard, PublicCoursePager } from "@/components/course/PublicCourseCard";
import { auth } from "@/lib/auth";
import { shouldHideStudentTariffUi } from "@/lib/feature-flags";
import { listPublicCourses, parsePageParam } from "@/lib/public-courses";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const query = q?.trim() ?? "";
  // Finding a course to buy must not require already owning one.
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`)}`);
  }

  const searching = query.length >= 2;
  const data = await listPublicCourses({ page: parsePageParam(page), query: searching ? query : "" });
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (searching) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/search?${s}` : "/search";
  };

  return (
    <AppShell>
      <div className="lx-board">
        <p className="lx-kicker">Qidiruv</p>
        <h2>{searching ? `"${query}" natijalari` : "E’lon qilingan kurslar"}</h2>
        <p className="muted small lx-lead">
          {query && !searching
            ? "Kamida 2 ta belgi yozing."
            : "Yuqoridagi qidiruvdan kurs, fan yoki o‘qituvchi nomini yozing."}
        </p>

        {data.items.length === 0 ? (
          <EmptyGuide
            title={searching ? "Hech narsa topilmadi" : "Hozircha kurs yo‘q"}
            text={
              searching
                ? `"${query}" bo‘yicha e’lon qilingan kurs yo‘q.`
                : "Yangi kurslar e’lon qilinganda shu yerda paydo bo‘ladi."
            }
            href="/my-courses"
            cta="Kurslarim"
          />
        ) : (
          <>
            <p className="muted small">{data.total} ta kurs</p>
            <div className="lx-course-grid" data-testid="search-course-grid">
              {data.items.map((course) => (
                <PublicCourseCard key={course.id} course={course} showPrice={shouldHideStudentTariffUi()} />
              ))}
            </div>
            <PublicCoursePager page={data.page} pages={data.pages} hrefFor={hrefFor} />
          </>
        )}
      </div>
    </AppShell>
  );
}
