import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
    const admin = await isAdminRequest(request);
    if (!admin) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file");

    // Resolve BOTH directories to support both local execution and Docker isolation
    const resultDir = path.resolve(process.cwd(), "../result");
    const publicResultDir = path.resolve(process.cwd(), "public/result");

    if (file) {
        const safeFile = path.basename(file);
        
        // Find file in either root result directory or public result directory
        let filePath = path.join(resultDir, safeFile);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(publicResultDir, safeFile);
        }

        if (!fs.existsSync(filePath)) {
            return new NextResponse("File not found", { status: 404 });
        }

        try {
            const fileBuffer = fs.readFileSync(filePath);

            // Set appropriate Content-Type headers
            let contentType = "application/octet-stream";
            const lowerFile = safeFile.toLowerCase();
            if (lowerFile.endsWith(".png")) {
                contentType = "image/png";
            } else if (lowerFile.endsWith(".jpg") || lowerFile.endsWith(".jpeg")) {
                contentType = "image/jpeg";
            } else if (lowerFile.endsWith(".docx")) {
                contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            } else if (lowerFile.endsWith(".xlsx")) {
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            } else if (lowerFile.endsWith(".pdf")) {
                contentType = "application/pdf";
            } else if (lowerFile.endsWith(".txt")) {
                contentType = "text/plain; charset=utf-8";
            }

            return new NextResponse(fileBuffer, {
                headers: {
                    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFile)}`,
                    "Content-Type": contentType,
                },
            });
        } catch {
            return new NextResponse("Failed to read file", { status: 500 });
        }
    }

    // List and merge files from both directories
    try {
        const fileMap = new Map<string, { filename: string; size: number }>();
        const dirsToScan = [];

        if (fs.existsSync(resultDir)) dirsToScan.push(resultDir);
        if (fs.existsSync(publicResultDir)) dirsToScan.push(publicResultDir);

        for (const dir of dirsToScan) {
            try {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    const filePath = path.join(dir, f);
                    const stat = fs.statSync(filePath);
                    if (stat.isFile()) {
                        fileMap.set(f, {
                            filename: f,
                            size: stat.size,
                        });
                    }
                }
            } catch (e) {
                console.error(`Failed to scan dir ${dir}:`, e);
            }
        }

        const fileList = Array.from(fileMap.values());
        return NextResponse.json(fileList);
    } catch {
        return NextResponse.json({ error: "Failed to read directories" }, { status: 500 });
    }
}

type MeResponse = {
    role?: string;
};

async function isAdminRequest(request: NextRequest) {
    const cookie = request.headers.get("cookie");
    if (!cookie) return false;

    const candidates = [
        process.env.BACKEND_INTERNAL_URL,
        "http://backend:8080",
        "http://localhost:8080",
    ].filter((value): value is string => Boolean(value));

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { cookie },
                cache: "no-store",
            });
            if (!response.ok) continue;
            const me = await response.json() as MeResponse;
            return me.role === "ADMIN";
        } catch {
            // Try the next backend address. Docker uses the service name; local dev often uses localhost.
        }
    }

    return false;
}
