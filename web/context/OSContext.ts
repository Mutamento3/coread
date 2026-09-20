// coread web 适配层：顶替 SullyOS 宿主的 OSContext。
// coread 是同源直连的纯 web 应用，没有 Capacitor/OS 主题/安卓返回手势，
// 这里给出 StudyApp.tsx 需要的最小语义等价物。

export interface BridgeConfig { url: string; key: string }
export interface OSTheme { hue: number; saturation: number; lightness: number }

// key 仅作「已配置」真值标记（SullyOS UI 在 key 为空时拒绝加载书架）；
// coread 服务端不做 Bearer 鉴权，同源请求天然可信。
const bridgeConfig: BridgeConfig = { url: '', key: 'coread-local' };
const theme: OSTheme = { hue: 245, saturation: 25, lightness: 65 };

let toastSeq = 0;
// 极简 toast：id 唯一、3 秒自消（对齐 SullyOS OSContext 的 addToast 语义）
function addToast(message: string): string {
    const id = `coread-toast-${++toastSeq}`;
    let host = document.getElementById('coread-toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'coread-toast-host';
        host.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;';
        document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.id = id;
    el.textContent = message;
    el.style.cssText = 'background:rgba(30,26,20,0.85);color:#fff;font-size:13px;line-height:1.5;padding:8px 16px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:opacity .3s;max-width:82vw;text-align:center;';
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 350); }, 3000);
    return id;
}

export function useOS() {
    return {
        closeApp: () => window.history.back(),
        bridgeConfig,
        theme,
        addToast,
        // web 端没有安卓返回手势；coread 自己的返回处理走 UI 上的按钮，这里登记即空操作
        registerBackHandler: (_handler: () => boolean) => () => {},
    };
}
