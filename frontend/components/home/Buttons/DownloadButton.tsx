"use client";

import { useState, useEffect, useRef } from "react";

interface ResultFile {
    filename: string;
    size: number;
}

export default function DownloadButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<ResultFile[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch the list of files
    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch("/download-api");
            if (response.ok) {
                const data: ResultFile[] = await response.json();
                setFiles(data);
            }
        } catch (err) {
            console.error("Failed to fetch download files:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch files when dropdown is opened
    useEffect(() => {
        if (isOpen) {
            void fetchFiles();
        }
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const triggerDownload = (filename: string) => {
        window.location.href = `/download-api?file=${encodeURIComponent(filename)}`;
        setIsOpen(false);
    };

    // Helper to format file sizes
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    // Helper to get file type details
    const getFileInfo = (filename: string) => {
        const lower = filename.toLowerCase();
        
        // Custom labels for the main presentation diagrams
        if (lower.includes("usecase")) {
            return {
                label: "유스케이스 다이어그램",
                description: "서비스 기능 구성 및 유스케이스 정의서",
                iconType: "image"
            };
        }
        if (lower.includes("erd")) {
            return {
                label: "데이터베이스 ERD",
                description: "회원, 계획, 결제 등 핵심 테이블 구조도",
                iconType: "image"
            };
        }
        if (lower.includes("gtfs")) {
            return {
                label: "GTFS 데이터베이스 스키마",
                description: "대중교통 노선/경로 테이블 데이터 설계도",
                iconType: "image"
            };
        }

        // Generic extensions
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
            return {
                label: filename,
                description: "Excel 스프레드시트 문서",
                iconType: "excel"
            };
        }
        if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
            return {
                label: filename,
                description: "Word 텍스트 문서",
                iconType: "word"
            };
        }
        if (lower.endsWith(".pdf")) {
            return {
                label: filename,
                description: "PDF 문서",
                iconType: "pdf"
            };
        }
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".svg")) {
            return {
                label: filename,
                description: "이미지 파일",
                iconType: "image"
            };
        }
        return {
            label: filename,
            description: "일반 파일",
            iconType: "file"
        };
    };

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="
                    relative flex h-[50px] items-center justify-center gap-2 rounded-[12px]
                    border-2 border-[rgba(0,0,0,0.15)] bg-white px-[20px]
                    font-[var(--font-paperlogy)] text-[18px] font-medium
                    text-black transition hover:bg-gray-50 focus:outline-none active:scale-[0.98]
                "
            >
                <span
                    aria-hidden={true}
                    className="pointer-events-none absolute inset-0 rounded-[12px] border-2 border-[rgba(0,0,0,0.15)]"
                />
                {/* Modern download icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-black"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
            </button>

            {/* Custom premium dropdown list */}
            {isOpen && (
                <div
                    className="
                        absolute left-1/2 mt-2 w-[340px] -translate-x-1/2 rounded-2xl
                        border border-gray-100 bg-white p-2 shadow-2xl ring-1 ring-black/5
                        z-50 animate-in fade-in slide-in-from-top-2 duration-150
                    "
                >
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 border-b border-gray-50 flex items-center justify-between uppercase tracking-wider">
                        <span>다운로드할 파일 선택</span>
                        <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); void fetchFiles(); }}
                            className="hover:text-gray-900 transition active:rotate-180 duration-200"
                            title="새로고침"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        </button>
                    </div>

                    <div className="mt-1 max-h-[300px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                        {loading ? (
                            <div className="py-8 text-center text-sm text-gray-400 flex flex-col items-center justify-center gap-2">
                                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                                파일을 불러오는 중...
                            </div>
                        ) : files.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400 font-medium">
                                result 폴더에 다운로드할 파일이 없습니다.
                            </div>
                        ) : (
                            files.map((file) => {
                                const info = getFileInfo(file.filename);
                                return (
                                    <button
                                        key={file.filename}
                                        onClick={() => triggerDownload(file.filename)}
                                        className="
                                            w-full text-left flex flex-col gap-0.5 rounded-xl px-3 py-2.5
                                            transition hover:bg-gray-50 active:bg-gray-100
                                        "
                                    >
                                        <span className="text-sm font-semibold text-gray-900 flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-1.5 truncate">
                                                {/* File specific SVG icon */}
                                                {info.iconType === "image" && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                )}
                                                {info.iconType === "excel" && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                )}
                                                {info.iconType === "word" && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 10h1.5a1.5 1.5 0 0 1 0 3H8v4h3"/></svg>
                                                )}
                                                {info.iconType === "pdf" && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v2"/><path d="M12 17v-4h1a1.5 1.5 0 0 1 0 3h-1"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>
                                                )}
                                                {info.iconType === "file" && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                )}
                                                <span className="truncate">{info.label}</span>
                                            </span>
                                            <span className="text-[10px] font-medium text-gray-400 shrink-0">
                                                {formatBytes(file.size)}
                                            </span>
                                        </span>
                                        <span className="text-xs text-gray-500 font-normal leading-relaxed pl-5 truncate">
                                            {info.description}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
