"use client";

import * as React from "react";
import { usersApi, ApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import type { PaginationMeta, User } from "@/lib/types";
import { Pager } from "@/components/pager";
import { toast as notify } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { MoreHorizontalIcon, SearchIcon, ShieldIcon, Trash2Icon, UserCogIcon, UserIcon } from "lucide-react";

export function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [page, setPage] = React.useState(1);
  const [roleFilter, setRoleFilter] = React.useState("__all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState<User | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        page,
        perPage: 15,
        role: roleFilter === "__all" ? undefined : roleFilter,
        search: search || undefined,
      });
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof ApiError) notify.error(err.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateUser = async (user: User, body: { role?: string; isActive?: boolean }) => {
    try {
      await usersApi.update(user.id, body);
      notify.success(`Updated ${user.name}`);
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Update failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await usersApi.remove(deleting.id);
      notify.success(`${deleting.name} deleted`);
      await load();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <InputGroup className="w-full max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </InputGroup>
        <Select
          items={[
            { value: "__all", label: "All roles" },
            { value: "user", label: "Users" },
            { value: "admin", label: "Admins" },
          ]}
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(String(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36" aria-label="Role filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground ml-auto text-sm">{meta ? `${meta.totalItems} users` : ""}</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="h-10 animate-pulse" />
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isSelf = user.id === me?.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 border">
                          <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {user.name}
                            {isSelf && <span className="text-muted-foreground"> (you)</span>}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive === false ? "destructive" : "outline"}>
                        {user.isActive === false ? "Deactivated" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <MoreHorizontalIcon className="text-muted-foreground ml-auto size-4 opacity-40" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`} />}>
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change role</DropdownMenuLabel>
                            <DropdownMenuItem
                              disabled={user.role === "admin"}
                              onSelect={() => void updateUser(user, { role: "admin" })}
                            >
                              <ShieldIcon /> Make admin
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={user.role === "user"}
                              onSelect={() => void updateUser(user, { role: "user" })}
                            >
                              <UserIcon /> Make user
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => void updateUser(user, { isActive: user.isActive === false })}
                            >
                              <UserCogIcon />
                              {user.isActive === false ? "Reactivate account" : "Deactivate account"}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(user)}>
                              <Trash2Icon /> Delete user
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {meta && <Pager meta={meta} onPageChange={setPage} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cascades: removes their enrollments, progress, reviews and certificates. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
