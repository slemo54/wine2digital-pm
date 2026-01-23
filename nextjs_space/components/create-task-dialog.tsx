"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  defaultStatus?: string;
  members: any[];
}

export function CreateTaskDialog({ open, onClose, onSuccess, projectId, defaultStatus, members }: CreateTaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assigneeIds: [] as string[],
    status: defaultStatus || "todo",
  });

  useEffect(() => {
    if (defaultStatus) {
      setFormData(prev => ({ ...prev, status: defaultStatus }));
    }
  }, [defaultStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      toast.success("Task created successfully!");
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        assigneeIds: [],
        status: defaultStatus || "todo",
      });
      onSuccess();
    } catch (error) {
      toast.error("Failed to create task");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to this project. Assign team members and set priorities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Design homepage mockup"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the task"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignee">Assign To</Label>
              <Select
                value={formData.assigneeIds?.[0] || ""}
                onValueChange={(value) => setFormData({ ...formData, assigneeIds: value ? [value] : [] })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members?.map((member) => (
                    <SelectItem key={member?.user?.id} value={member?.user?.id}>
                      {member?.user?.firstName} {member?.user?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
