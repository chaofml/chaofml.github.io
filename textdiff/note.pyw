import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import re

class TextProcessorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("多行文本处理")
        self.setup_ui()

    def setup_ui(self):
        # 主框架
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 输入框
        input_label = ttk.Label(main_frame, text="输入多行文本：")
        input_label.pack(anchor=tk.W)
        
        self.input_text = tk.Text(main_frame, height=10, width=80)
        self.input_text.pack(fill=tk.BOTH, expand=True)

        # 选项框架
        options_frame = ttk.Frame(main_frame)
        options_frame.pack(fill=tk.X, pady=10)

        # 选项1：忽略空行
        self.ignore_empty = tk.BooleanVar(value=True)
        ignore_empty_cb = ttk.Checkbutton(
            options_frame, text="忽略空行", variable=self.ignore_empty
        )
        ignore_empty_cb.grid(row=0, column=0, sticky=tk.W, padx=5)

        # 选项2：去除首尾空格
        self.trim_lines = tk.BooleanVar(value=True)
        trim_lines_cb = ttk.Checkbutton(
            options_frame, text="去除首尾空格", variable=self.trim_lines
        )
        trim_lines_cb.grid(row=0, column=1, sticky=tk.W, padx=5)

        # 选项3：去重
        self.remove_duplicates = tk.BooleanVar()
        remove_duplicates_cb = ttk.Checkbutton(
            options_frame, text="去重", variable=self.remove_duplicates
        )
        remove_duplicates_cb.grid(row=0, column=2, sticky=tk.W, padx=5)

        # 新增选项4：窗口置顶
        self.window_topmost = tk.BooleanVar()
        topmost_cb = ttk.Checkbutton(
            options_frame, 
            text="窗口置顶", 
            variable=self.window_topmost,
            command=self.toggle_topmost
        )
        topmost_cb.grid(row=0, column=3, sticky=tk.W, padx=5)

        # 分隔符选择
        delimiter_frame = ttk.Frame(options_frame)
        delimiter_frame.grid(row=0, column=4, padx=5)

        delimiter_label = ttk.Label(delimiter_frame, text="分隔符号：")
        delimiter_label.pack(side=tk.LEFT)

        self.delimiter_var = tk.StringVar(value=",")
        # delimiter_options = [",", ";", "|", " "]
        delimiter_options = [",", ";", "|", " ", "\n","custom"]  
        delimiter_menu = ttk.OptionMenu(
            delimiter_frame, self.delimiter_var, ",", *delimiter_options
        )
        delimiter_menu.pack(side=tk.LEFT)

        # 自定义分隔符
        self.custom_delimiter = ttk.Entry(delimiter_frame, width=5)
        self.custom_delimiter.pack(side=tk.LEFT)
        self.custom_delimiter.insert(0, "输入分隔符")
        self.custom_delimiter.config(state="disabled")

        # 正则表达式输入
        regex_frame = ttk.Frame(options_frame)
        regex_frame.grid(row=0, column=5, padx=5)

        regex_label = ttk.Label(regex_frame, text="正则表达式：")
        regex_label.pack(side=tk.LEFT)

        self.regex_input = ttk.Entry(regex_frame, width=20)
        self.regex_input.pack(side=tk.LEFT)
        self.regex_input.insert(0, "")

        # 新增模板输入框
        template_frame = ttk.Frame(options_frame)
        template_frame.grid(row=0, column=6, padx=5)

        template_label = ttk.Label(template_frame, text="模板（如：temp%s）：")
        template_label.pack(side=tk.LEFT)

        self.template_input = ttk.Entry(template_frame, width=20)
        self.template_input.pack(side=tk.LEFT)
        self.template_input.insert(0, "")

        # 处理按钮
        process_btn = ttk.Button(
            main_frame, text="处理文本", command=self.process_text
        )
        process_btn.pack(pady=5)

        # 结果框
        result_label = ttk.Label(main_frame, text="处理结果：")
        result_label.pack(anchor=tk.W)

        self.result_text = tk.Text(main_frame, height=5, width=80)
        self.result_text.pack(fill=tk.BOTH, expand=True)

        # 操作按钮
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(pady=5)

        copy_btn = ttk.Button(
            button_frame, text="复制结果", command=self.copy_result
        )
        copy_btn.pack(side=tk.LEFT, padx=5)

        export_btn = ttk.Button(
            button_frame, text="导出结果", command=self.export_result
        )
        export_btn.pack(side=tk.LEFT, padx=5)

        # 绑定事件
        self.delimiter_var.trace_add("write", self.toggle_custom_delimiter)

    def toggle_topmost(self):
        """切换窗口置顶状态"""
        self.root.attributes('-topmost', self.window_topmost.get())

    def toggle_custom_delimiter(self, *args):
        if self.delimiter_var.get() == "custom":
            self.custom_delimiter.config(state="normal")
        else:
            self.custom_delimiter.config(state="disabled")

    def process_text(self):
        input_text = self.input_text.get("1.0", tk.END)
        ignore_empty = self.ignore_empty.get()
        trim_lines = self.trim_lines.get()
        remove_duplicates = self.remove_duplicates.get()
        delimiter = self.custom_delimiter.get() if self.delimiter_var.get() == "custom" else self.delimiter_var.get()
        regex_pattern = self.regex_input.get()
        template = self.template_input.get()

        lines = input_text.split("\n")
        
        # 去除首尾空格
        if trim_lines:
            lines = [line.strip() for line in lines]
        
        # 忽略空行
        if ignore_empty:
            lines = [line for line in lines if line]
        
        # 正则匹配
        if regex_pattern:
            try:
                regex = re.compile(regex_pattern)
                all_matches = []
                for line in lines:
                    matches = regex.findall(line)
                    if matches:
                        all_matches.extend(matches)
                lines = all_matches
            except re.error as e:
                messagebox.showerror("错误", f"正则表达式无效: {e}")
                return
        
        # 去重
        if remove_duplicates:
            seen = set()
            unique_lines = []
            for line in lines:
                if line not in seen:
                    seen.add(line)
                    unique_lines.append(line)
            lines = unique_lines
        
        # 模板替换
        if template:
            try:
                # lines = [template % (float(line) if line.isdigit() else line) for line in lines]              
                lines = [template % line for line in lines]              
            except Exception as e:
                # 如果没有明确的占位符，默认在末尾添加
                lines = ['%s%s'%(template, line) for line in lines]

        # 显示结果
        result = delimiter.join(lines)
        self.result_text.delete("1.0", tk.END)
        self.result_text.insert("1.0", result)

    def copy_result(self):
        result = self.result_text.get("1.0", tk.END)
        if result.strip():
            try:
                self.root.clipboard_clear()
                self.root.clipboard_append(result)
                messagebox.showinfo("成功", "结果已复制到剪贴板！")
            except Exception as e:
                messagebox.showerror("错误", f"复制失败: {e}")
        else:
            messagebox.showwarning("警告", "结果为空，无法复制！")

    def export_result(self):
        result = self.result_text.get("1.0", tk.END)
        if result.strip():
            file_path = filedialog.asksaveasfilename(
                defaultextension=".txt",
                filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
            )
            if file_path:
                try:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(result)
                    messagebox.showinfo("成功", "结果已导出！")
                except Exception as e:
                    messagebox.showerror("错误", f"导出失败: {e}")
        else:
            messagebox.showwarning("警告", "结果为空，无法导出！")

if __name__ == "__main__":
    root = tk.Tk()
    root.geometry("800x600")
    app = TextProcessorApp(root)
    root.mainloop()
