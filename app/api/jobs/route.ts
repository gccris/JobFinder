import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, authorizeUser } from "@/lib/api-authorization";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeUser();
    if (authorization.response) return authorization.response;
    const user = authorization.user;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const category = searchParams.get("category");
    const categories = searchParams
      .get("categories")
      ?.split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const location = searchParams.get("location");
    const search = searchParams.get("search");
    const employmentType = searchParams.get("employmentType");
    const seniority = searchParams.get("seniority");
    const department = searchParams.get("department");
    const salaryMin = parseOptionalInt(searchParams.get("salaryMin"));
    const salaryMax = parseOptionalInt(searchParams.get("salaryMax"));
    const salaryOnly = searchParams.get("salaryOnly") === "true";
    const sortBy = searchParams.get("sortBy") || "postedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const workplaceTypes = searchParams
      .get("workplaceTypes")
      ?.split(",")
      .map((type) => type.trim().toUpperCase())
      .filter(Boolean);

    const skip = (page - 1) * limit;

    // Build filter
    const where: any = { status: "OPEN" };

    if (category) {
      where.category = category.toUpperCase();
    }

    if (categories && categories.length > 0) {
      where.category = {
        in: categories,
      };
    }

    if (location) {
      where.location = {
        contains: location,
        mode: "insensitive",
      };
    }

    if (employmentType) {
      where.employmentType = {
        contains: employmentType,
        mode: "insensitive",
      };
    }

    if (seniority) {
      where.seniority = {
        contains: seniority,
        mode: "insensitive",
      };
    }

    if (department) {
      where.department = {
        contains: department,
        mode: "insensitive",
      };
    }

    if (salaryMin !== undefined || salaryMax !== undefined) {
      where.AND = [
        ...(where.AND || []),
        {
          salaryMin: {
            ...(salaryMin !== undefined ? { gte: salaryMin } : {}),
            ...(salaryMax !== undefined ? { lte: salaryMax } : {}),
          },
        },
      ];
    }

    if (salaryOnly) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { salary: { not: null } },
            { salaryMin: { not: null } },
            { salaryMax: { not: null } },
          ],
        },
      ];
    }

    if (workplaceTypes && workplaceTypes.length > 0) {
      where.workplaceType = {
        in: Array.from(new Set([...workplaceTypes, "UNSPECIFIED"])),
      };
    }

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          company: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          department: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          seniority: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          employmentType: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          company: true,
          location: true,
          salary: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryInterval: true,
          workplaceType: true,
          source: true,
          externalId: true,
          externalReference: true,
          externalUpdatedAt: true,
          url: true,
          applicationUrl: true,
          jobUrl: true,
          category: true,
          employmentType: true,
          seniority: true,
          department: true,
          requirements: true,
          tags: true,
          postedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          savedByUsers: user ? { where: { userId: user.id }, select: { id: true } } : false,
          applications: user ? { where: { userId: user.id }, select: { status: true } } : false,
        },
        orderBy:
          sortBy === "title"
            ? {
                title: sortOrder,
              }
            : sortBy === "salaryMin"
              ? {
                  salaryMin: sortOrder,
                }
              : sortBy === "postedAt"
            ? {
                postedAt: sortOrder,
              }
            : {
                postedAt: "desc",
              },
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({
      data: jobs.map((job) => ({
        ...job,
        saved: Array.isArray(job.savedByUsers) && job.savedByUsers.length > 0,
        applicationStatus: Array.isArray(job.applications) ? job.applications[0]?.status ?? null : null,
        savedByUsers: undefined,
        applications: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

function parseOptionalInt(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function DELETE() {
  try {
    const authorization = await authorizeAdmin();
    if (authorization.response) return authorization.response;
    const jobsResult = await db.job.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: {
        jobs: jobsResult.count,
      },
    });
  } catch (error) {
    console.error("Error deleting jobs:", error);
    return NextResponse.json(
      { error: "Failed to delete jobs" },
      { status: 500 }
    );
  }
}
