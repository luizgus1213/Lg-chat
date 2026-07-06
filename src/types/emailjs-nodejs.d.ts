declare module "@emailjs/nodejs" {
  type TemplateParams = Record<string, unknown>;

  type EmailJsOptions = {
    publicKey?: string;
    privateKey?: string;
    limitRate?: {
      id?: string;
      throttle?: number;
    };
  };

  type EmailJsResponse = {
    status: number;
    text: string;
  };

  const emailjs: {
    send(
      serviceId: string,
      templateId: string,
      templateParams?: TemplateParams,
      options?: EmailJsOptions,
    ): Promise<EmailJsResponse>;
  };

  export default emailjs;
}
