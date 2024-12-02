using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Scanner.Components.Pages;

public class ScannerPageBase : ComponentBase, IAsyncDisposable
{
    [Inject] protected IJSRuntime JsRuntime { get; set; } = default!;
    [Inject] protected NavigationManager NavigationManager { get; set; } = default!;

    private IJSObjectReference? _jsModule;
    private DotNetObjectReference<ScannerPageBase>? _componentReference;

    protected const string OverlayId = "overlay";
    protected const string VideoContainerId = "videoContainer";

    private const string LicenseKey = "";

    protected override void OnInitialized() => _componentReference = DotNetObjectReference.Create(this);

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;

        _jsModule = await JsRuntime.InvokeAsync<IJSObjectReference>("import", ["../Components/Pages/ScannerPage.razor.js"]);

        if (_componentReference is not null && _jsModule is not null)
            await _jsModule.InvokeVoidAsync("createScanner", _componentReference, LicenseKey, VideoContainerId, OverlayId);
    }

    [JSInvokable]
    public void ReturnBarcodeResults(string text)
    {
        if (Uri.TryCreate(text, UriKind.Absolute, out var uri))
        {
            var redirectUri = new Uri(new Uri("https://resolver.nobb.no"), uri.AbsolutePath);
            NavigationManager.NavigateTo(redirectUri.ToString());
        }
        else
        {
            NavigationManager.NavigateTo("https://nobb.no/item/60138152");
        }
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_jsModule is not null)
            {
                await _jsModule.InvokeVoidAsync("disposeScanner");
                await _jsModule.DisposeAsync();
            }
            _componentReference?.Dispose();
        }
        catch (JSDisconnectedException)
        {
            // Safe to ignore
        }
    }
}

