import { Menu } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Icon } from "./Icon";

/** The navigation as a sheet, shown only below the `md` breakpoint. It traps focus and returns it on close. */
export function MobileMenu({
  links,
  action,
  repository,
}: {
  links: readonly { label: string; href: string }[];
  action?: { label: string; href: string };
  /** The repository button of the header, which has no room in the bar on a phone. */
  repository?: { href: string; name: string; icon: string };
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg-bright md:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
          {links.map((link) => (
            <SheetClose asChild key={link.href}>
              <a
                href={link.href}
                className="rounded-md px-3 py-2.5 text-fg-muted hover:bg-surface-2 hover:text-fg-bright"
              >
                {link.label}
              </a>
            </SheetClose>
          ))}
          {repository && (
            <a
              href={repository.href}
              target="_blank"
              rel="noopener noreferrer"
              data-repository-button
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-fg-muted hover:bg-surface-2 hover:text-fg-bright"
            >
              <Icon name={repository.icon} className="size-5" />
              {repository.name}
            </a>
          )}
          {action && (
            <a
              href={action.href}
              className="mt-3 rounded-md bg-primary px-3 py-2.5 text-center font-medium text-primary-foreground"
            >
              {action.label}
            </a>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
