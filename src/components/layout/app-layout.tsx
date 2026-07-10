import {
  ChevronDown,
  ChevronLeft,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { mobileNavItems, navGroups, navItems } from "./nav";
import { useAuthStore } from "../../store/auth.store";
import { cn } from "../../lib/utils";
import { hasPermission } from "../../lib/permissions";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const current = navItems?.find((item) => item?.path === location?.pathname);
  const canSeeItem = (item: (typeof navItems)[number]) =>
    item.adminOnly ? user?.role === "ADMIN" : hasPermission(user, item.permission);
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(canSeeItem),
        }))
        .filter((group) => group.items.length),
    [user],
  );
  const visibleMobileItems = mobileNavItems.filter(canSeeItem);
  const currentGroup = useMemo(
    () =>
      visibleGroups.find((group) =>
        group.items.some((item) => item?.path === location.pathname),
      )?.label ?? "Principal",
    [location.pathname, visibleGroups],
  );
  const [openGroup, setOpenGroup] = useState(currentGroup);

  useEffect(() => {
    setOpenGroup(currentGroup);
  }, [currentGroup]);

  // Bloquear el scroll del body cuando el sidebar móvil está abierto.
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileOpen]);

  const doLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-svh bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-[#10231f] text-white transition-all md:flex md:flex-col",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-lg font-bold text-secondary-foreground">
            I
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold">Iguazú</p>
              <p className="text-xs text-white/60">Hotel MVP</p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {collapsed
            ? visibleGroups.map((group, index) => (
                <div
                  key={group.label}
                  className={cn(
                    "space-y-1 py-1",
                    index > 0 && "border-t border-white/10",
                  )}
                >
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          "flex h-10 items-center justify-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white",
                          isActive &&
                            "bg-white text-[#10231f] hover:bg-white hover:text-[#10231f]",
                        )
                      }
                      title={`${group.label}: ${item.label}`}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                    </NavLink>
                  ))}
                </div>
              ))
            : visibleGroups.map((group) => {
                const isCurrentGroup = group.items.some(
                  (item) => item?.path === location.pathname,
                );
                const open = openGroup === group.label;
                return (
                  <div key={group.label} className="space-y-1">
                    <button
                      type="button"
                      className={cn(
                        "mt-2 flex h-8 w-full items-center justify-between rounded-md px-3 text-[11px] font-semibold uppercase tracking-wide text-white/45 hover:bg-white/5 hover:text-white/70",
                        isCurrentGroup && "text-white/70",
                      )}
                      onClick={() =>
                        setOpenGroup((value) =>
                          value === group.label ? "" : group.label,
                        )
                      }
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {open && (
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                              cn(
                                "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white",
                                isActive &&
                                  "bg-white text-[#10231f] hover:bg-white hover:text-[#10231f]",
                              )
                            }
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-white hover:bg-white/10"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
            {!collapsed && <span>Contraer</span>}
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/35 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="flex h-full w-80 max-w-[85vw] flex-col bg-[#10231f] p-3 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between">
              <span className="font-semibold">Iguazú</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white"
                onClick={() => setMobileOpen(false)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-3 overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex h-11 items-center gap-3 rounded-md px-3 text-sm text-white/75",
                            isActive && "bg-white text-[#10231f]",
                          )
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div
        className={cn(
          "min-h-svh pb-20 transition-all md:pb-0",
          collapsed ? "md:pl-20" : "md:pl-64",
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">
                {current?.label ?? "Iguazú"}
              </p>
              <p className="hidden text-sm text-muted-foreground sm:block">
                Operación hotelera
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="max-w-[190px] justify-start">
                <UserRound className="h-4 w-4" />
                <span className="truncate">
                  {user?.employee?.fullName ?? user?.username ?? "Usuario"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={doLogout}>
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-card md:hidden">
        {visibleMobileItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "grid place-items-center gap-1 py-2 text-[11px] text-muted-foreground",
                isActive && "text-primary",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
