import { BulkProcessControl } from "./BulkProcessControl";

export const metadata = {
  title: "Bulk Processing | Inbox Zero",
};

export default async function BulkProcessPage(props: {
  params: Promise<{ emailAccountId: string }>;
}) {
  const { emailAccountId } = await props.params;
  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Bulk Automations</h1>
        <p className="text-muted-foreground">
          Run your AI rules and automations on your existing email history.
          This process runs in the background and can be paused or stopped at any time.
        </p>
      </div>
      
      <BulkProcessControl emailAccountId={emailAccountId} />
    </div>
  );
}
