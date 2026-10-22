"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cloud, ExternalLink, Unplug } from "lucide-react"

export default function DrivePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dropbox-connection"],
    queryFn: async () => (await fetch("/api/storage/dropbox")).json(),
  })
  const connected = Boolean(data?.connected)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Personal Drive</h1>
        <p className="mt-1 text-muted-foreground">Store ALEX documents in your own Dropbox account.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" />Dropbox storage</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <p className="text-muted-foreground">Checking connection…</p> : connected ? (
            <>
              <p>Connected to {data.connection?.accountEmail || "your Dropbox account"}.</p>
              <Button variant="outline" onClick={async () => { await fetch("/api/storage/dropbox", { method: "DELETE" }); location.reload() }}><Unplug className="mr-2 h-4 w-4" />Disconnect Dropbox</Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">ALEX will use an app-specific Dropbox folder and will not access unrelated files.</p>
              <Button asChild><a href="/api/storage/dropbox/connect"><ExternalLink className="mr-2 h-4 w-4" />Connect Dropbox</a></Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
