import { api } from "@/service/api";

export type PaymentRequestStatus = "PENDING" | "APPROVED";

export type PaymentRequest = {
    id: number;
    planId: string;
    planTitle: string;
    requesterUserId: number;
    requesterEmail: string;
    requesterNickname?: string | null;
    depositorName: string;
    depositBank: string;
    depositAccount: string;
    amount: number;
    status: PaymentRequestStatus;
    createdAt: string;
    approvedAt?: string | null;
    approvedByUserId?: number | null;
    approvedByEmail?: string | null;
};

export async function createPaymentRequest(input: {
    planId: string;
    planTitle: string;
    depositorName: string;
    depositBank: string;
    depositAccount: string;
}) {
    const response = await api.post<PaymentRequest>("/api/payments", input);
    return response.data;
}

export async function loadPaymentRequests() {
    const response = await api.get<PaymentRequest[]>("/api/payments");
    return response.data;
}

export async function approvePaymentRequest(id: number) {
    const response = await api.patch<PaymentRequest>(`/api/payments/${id}/approve`);
    return response.data;
}
