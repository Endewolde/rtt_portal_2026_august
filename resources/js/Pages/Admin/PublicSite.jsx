import { Globe } from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { PageHeader } from '../../Components/Insights/Kit'
import PublicSiteEditor from '../../Components/PublicSiteEditor'

/**
 * Admin → Public Site. The same editor as Settings → Public Site, so the homepage is
 * managed in one way whichever door you come in by.
 */
export default function PublicSite() {
    return (
        <AppLayout breadcrumb="Public Site">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={Globe} color="emerald" title="Public Site"
                    description="The public homepage: header, hero slider, menu, sections, colours and social links." />
                <PublicSiteEditor />
            </div>
        </AppLayout>
    )
}
