using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Windows;

namespace FocusTrace.Agent;

public partial class App : System.Windows.Application
{
    private IHost? _host;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        try
        {
            var builder = Host.CreateApplicationBuilder(
                new HostApplicationBuilderSettings
                {
                    ContentRootPath = AppContext.BaseDirectory
                }
            );

            builder.Services.AddSingleton<Worker>();

            builder.Services.AddHostedService(
                sp => sp.GetRequiredService<Worker>()
            );

            _host = builder.Build();

            await _host.StartAsync();

            var worker = _host.Services.GetRequiredService<Worker>();

            var window = new MainWindow(worker);

            MainWindow = window;

            window.Show();
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show(
                 ex.ToString(),
                 "FocusTrace Startup Error",
                 MessageBoxButton.OK,
                 MessageBoxImage.Error
             );

            Shutdown(1);
        }
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        try
        {
            if (_host != null)
            {
                await _host.StopAsync();
                _host.Dispose();
            }
        }
        finally
        {
            base.OnExit(e);
        }
    }
}