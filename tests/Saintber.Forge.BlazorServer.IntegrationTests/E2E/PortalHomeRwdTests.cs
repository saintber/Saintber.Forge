using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;
using Assert = NUnit.Framework.Assert;

namespace Saintber.Forge.BlazorServer.IntegrationTests.E2E;

/// <summary>
/// Portal Home RWD 響應式設計端對端測試
/// 驗證首頁在不同螢幕寬度下的佈局正確性
/// </summary>
[Parallelizable(ParallelScope.Self)]
[TestFixture]
[Category("E2E")]
[Category("RWD")]
public class PortalHomeRwdTests : PageTest
{
    private const string BaseUrl = "https://localhost:7289";

    [SetUp]
    public async Task Setup()
    {
        // 忽略 HTTPS 憑證錯誤（本地開發環境）
        await Context.GrantPermissionsAsync(new[] { "geolocation" });
    }

    [Test]
    [Description("桌機模式（1920px）應顯示 4 欄佈局")]
    public async Task Desktop_ShowsFourColumnLayout()
    {
        // Arrange: 設定桌機視窗大小
        await Page.SetViewportSizeAsync(1920, 1080);

        // Act: 訪問首頁
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 等待 tool-grid 載入
        var grid = Page.Locator(".tool-grid");
        await Expect(grid).ToBeVisibleAsync();

        // 驗證 grid-template-columns 為 4 欄
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(4), 
            $"桌機模式應顯示 4 欄，實際顯示 {columnCount} 欄。CSS: {columns}");
    }

    [Test]
    [Description("平板模式（800px）應顯示 2 欄佈局")]
    public async Task Tablet_ShowsTwoColumnLayout()
    {
        // Arrange: 設定平板視窗大小
        await Page.SetViewportSizeAsync(800, 600);

        // Act: 訪問首頁
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 驗證 grid-template-columns 為 2 欄
        var grid = Page.Locator(".tool-grid");
        await Expect(grid).ToBeVisibleAsync();

        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(2), 
            $"平板模式應顯示 2 欄，實際顯示 {columnCount} 欄。CSS: {columns}");
    }

    [Test]
    [Description("手機模式（375px）應顯示單欄佈局")]
    public async Task Mobile_ShowsSingleColumnLayout()
    {
        // Arrange: 設定手機視窗大小（iPhone SE 尺寸）
        await Page.SetViewportSizeAsync(375, 667);

        // Act: 訪問首頁
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 驗證 grid-template-columns 為 1 欄
        var grid = Page.Locator(".tool-grid");
        await Expect(grid).ToBeVisibleAsync();

        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(1), 
            $"手機模式應顯示單欄，實際顯示 {columnCount} 欄。CSS: {columns}");
    }

    [Test]
    [Description("手機模式不應產生水平捲軸")]
    public async Task Mobile_NoHorizontalScrollbar()
    {
        // Arrange: 設定手機視窗大小
        await Page.SetViewportSizeAsync(375, 667);

        // Act: 訪問首頁
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 驗證內容寬度不超過視窗寬度
        var bodyWidth = await Page.EvaluateAsync<int>("() => document.body.scrollWidth");
        var viewportWidth = await Page.EvaluateAsync<int>("() => window.innerWidth");

        Assert.That(bodyWidth, Is.LessThanOrEqualTo(viewportWidth + 1), 
            $"手機模式不應產生水平捲軸。內容寬度: {bodyWidth}px, 視窗寬度: {viewportWidth}px");
    }

    [Test]
    [Description("所有螢幕尺寸下 Tool 卡片應可見且可點擊")]
    [TestCase(375, 667, "手機")]
    [TestCase(800, 600, "平板")]
    [TestCase(1920, 1080, "桌機")]
    public async Task AllViewports_ToolCardsVisibleAndClickable(int width, int height, string deviceName)
    {
        // Arrange
        await Page.SetViewportSizeAsync(width, height);

        // Act
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 驗證至少有一張卡片顯示（公開 Tool A）
        var cards = Page.Locator(".tool-card");
        var cardCount = await cards.CountAsync();
        Assert.That(cardCount, Is.GreaterThanOrEqualTo(1), 
            $"{deviceName}模式應至少顯示 1 張卡片");

        // 驗證第一張卡片可見
        await Expect(cards.First).ToBeVisibleAsync();

        // 驗證卡片內的連結可點擊
        var firstCardLink = cards.First.Locator("a.tool-link");
        await Expect(firstCardLink).ToBeVisibleAsync();
        
        var isClickable = await firstCardLink.IsEnabledAsync();
        Assert.That(isClickable, Is.True, 
            $"{deviceName}模式下卡片連結應可點擊");
    }

    [Test]
    [Description("邊界條件測試：768px 切換點（平板最小寬度）")]
    public async Task Boundary_768px_ShowsTwoColumnLayout()
    {
        // Arrange: 設定恰好為平板最小寬度
        await Page.SetViewportSizeAsync(768, 600);

        // Act
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 應顯示 2 欄（min-width: 768px 觸發）
        var grid = Page.Locator(".tool-grid");
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(2), 
            $"768px（平板最小寬度）應顯示 2 欄，實際顯示 {columnCount} 欄");
    }

    [Test]
    [Description("邊界條件測試：767px 切換點（手機最大寬度）")]
    public async Task Boundary_767px_ShowsSingleColumnLayout()
    {
        // Arrange: 設定恰好低於平板最小寬度
        await Page.SetViewportSizeAsync(767, 600);

        // Act
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 應顯示單欄（< 768px）
        var grid = Page.Locator(".tool-grid");
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(1), 
            $"767px（手機最大寬度）應顯示單欄，實際顯示 {columnCount} 欄");
    }

    [Test]
    [Description("邊界條件測試：1200px 切換點（桌機最小寬度）")]
    public async Task Boundary_1200px_ShowsFourColumnLayout()
    {
        // Arrange: 設定恰好為桌機最小寬度
        await Page.SetViewportSizeAsync(1200, 800);

        // Act
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 應顯示 4 欄（min-width: 1200px 觸發）
        var grid = Page.Locator(".tool-grid");
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(4), 
            $"1200px（桌機最小寬度）應顯示 4 欄，實際顯示 {columnCount} 欄");
    }

    [Test]
    [Description("邊界條件測試：1199px 切換點（平板最大寬度）")]
    public async Task Boundary_1199px_ShowsTwoColumnLayout()
    {
        // Arrange: 設定恰好低於桌機最小寬度
        await Page.SetViewportSizeAsync(1199, 800);

        // Act
        await Page.GotoAsync(BaseUrl, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

        // Assert: 應顯示 2 欄（768px <= width < 1200px）
        var grid = Page.Locator(".tool-grid");
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        
        var columnCount = columns.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        Assert.That(columnCount, Is.EqualTo(2), 
            $"1199px（平板最大寬度）應顯示 2 欄，實際顯示 {columnCount} 欄");
    }
}
