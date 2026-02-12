using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.UI;
using Saintber.Forge.BlazorServer.Data;
using Saintber.Forge.BlazorServer.Services;
using Saintber.Forge.Persistence.EF.Postgres;
using GitHub.Copilot.SDK;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions;
using Saintber.Forge.Tools.LyricsGuessGame.BLL;
using Saintber.Forge.Tools.LyricsGuessGame.BLL.Config;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddControllersWithViews().AddMicrosoftIdentityUI();
builder.Services.AddServerSideBlazor();
builder.Services.AddSingleton<WeatherForecastService>();

// Add DbContext with PostgreSQL
builder.Services.AddDbContext<PortalDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("PortalDb")));

// Add Microsoft Identity Web Authentication
builder.Services.AddMicrosoftIdentityWebAppAuthentication(builder.Configuration, "AzureAd");
builder.Services.AddAuthorization();

// Register ToolRegistrationService
builder.Services.AddScoped<IToolRegistrationService, ToolRegistrationService>();

// Register UserIdentityService
builder.Services.AddScoped<IUserIdentityService, UserIdentityService>();

// Register GitHub Copilot SDK (T041)
var githubToken = Environment.GetEnvironmentVariable("GITHUB_TOKEN")
    ?? builder.Configuration["Copilot:GitHubToken"]
    ?? throw new InvalidOperationException("GITHUB_TOKEN environment variable or Copilot:GitHubToken configuration is required");

builder.Services.AddSingleton(sp => new CopilotClient(new CopilotClientOptions
{
    GithubToken = githubToken,
    UseLoggedInUser = false
}));

// Bind LyricsGuessGameConfig (T044)
var lyricsGameConfig = new LyricsGuessGameConfig();
builder.Configuration.GetSection(LyricsGuessGameConfig.SectionName).Bind(lyricsGameConfig);
builder.Services.AddSingleton(lyricsGameConfig);

// Register AI Service Provider (T042)
builder.Services.AddScoped<IAIServiceProvider, CopilotAIServiceProvider>();

// Register Lyrics Guess Game Service (T043)
builder.Services.AddScoped<ILyricsGuessGameService, LyricsGuessGameService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapRazorPages();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
