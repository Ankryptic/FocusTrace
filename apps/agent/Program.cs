using FocusTrace.Agent;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Windows;

namespace FocusTrace.Agent;

public partial class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);

        builder.Services.AddSingleton<Worker>();

        using var host = builder.Build();

        host.Start();

        var worker = host.Services.GetRequiredService<Worker>();

        var application = new System.Windows.Application();

        var window = new MainWindow(worker);

        application.Run(window);

        host.StopAsync().GetAwaiter().GetResult();
    }
}