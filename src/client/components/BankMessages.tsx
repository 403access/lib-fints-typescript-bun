import type { BankingInformation } from "../types/fints";

export interface BankMessagesProps {
    bankingInformation: BankingInformation;
}

export function BankMessages({ bankingInformation }: BankMessagesProps) {
    if (!bankingInformation?.bankMessages?.length) {
        return null;
    }

    return (
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {bankingInformation.bankMessages.map((m, i) => (
                <li key={`${m.subject || "message"}-${i}`}>
                    <span className="font-medium">{m.subject || "Message"}:</span>{" "}
                    {m.text}
                </li>
            ))}
        </ul>
    );
}
