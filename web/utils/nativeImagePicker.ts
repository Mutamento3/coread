// coread web 适配层：顶替 SullyOS 的 Capacitor 原生多选文件选择器。
// 返回 null 时 StudyApp 会回退到隐藏的 <input multiple>，web 端天然兼容。
export async function pickMultipleFiles(_accept: string[]): Promise<File[] | null> {
    return null;
}
