/**
 * Minimal Chrome extension types for PhishShield
 * This is a simplified subset of @types/chrome to avoid dependency installation issues
 */

declare global {
  namespace chrome {
    namespace runtime {
      interface MessageSender {
        tab?: chrome.tabs.Tab
      }

      function sendMessage(message: any, callback?: (response: any) => void): Promise<any>
      function getURL(path: string): string
      const onMessage: chrome.events.Event<(message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void>
    }

    namespace tabs {
      interface Tab {
        id?: number
        url?: string
        status?: string
      }

      function query(queryInfo: any): Promise<Tab[]>
      function query(queryInfo: any, callback: (tabs: Tab[]) => void): void
      function sendMessage(tabId: number, message: any, callback?: (response: any) => void): Promise<any>
      function captureVisibleTab(
        windowId?: number,
        options?: any,
        callback?: (screenshotUrl: string) => void
      ): Promise<string>

      const onUpdated: chrome.events.Event<(tabId: number, changeInfo: any, tab: Tab) => void>
      const onRemoved: chrome.events.Event<(tabId: number) => void>
    }

    namespace action {
      function setBadgeText(details: { text: string; tabId?: number }): Promise<void>
      function setBadgeBackgroundColor(details: { color: string; tabId?: number }): Promise<void>
    }

    namespace storage {
      namespace local {
        function get(keys: string[] | null, callback: (items: any) => void): void
        function set(items: Record<string, any>, callback?: () => void): void
        function remove(keys: string | string[], callback?: () => void): void
      }
    }

    namespace events {
      interface Event<T> {
        addListener(callback: T): void
        removeListener(callback: T): void
      }
    }
  }
}

export {}
