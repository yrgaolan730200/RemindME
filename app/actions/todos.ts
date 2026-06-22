"use server"

import { db } from "@/lib/db"
import { todos, type Todo } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getTodos(): Promise<Todo[]> {
  return db.select().from(todos).orderBy(asc(todos.dueDate), asc(todos.dueTime))
}

export async function addTodo(input: { title: string; dueDate: string; dueTime: string }) {
  const title = input.title.trim()
  if (!title) throw new Error("请输入待办名称")
  if (!input.dueDate) throw new Error("请选择日期")
  if (!input.dueTime) throw new Error("请选择时间")

  await db.insert(todos).values({
    title,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
  })
  revalidatePath("/")
  revalidatePath("/history")
}

export async function toggleTodo(id: number, completed: boolean) {
  await db.update(todos).set({ completed }).where(eq(todos.id, id))
  revalidatePath("/")
  revalidatePath("/history")
}

export async function deleteTodo(id: number) {
  await db.delete(todos).where(eq(todos.id, id))
  revalidatePath("/")
  revalidatePath("/history")
}
