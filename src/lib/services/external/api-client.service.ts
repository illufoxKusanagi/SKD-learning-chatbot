interface ExternalDocument {
  id: string;
  content: string;
  source: string;
  metadata: any;
  timestamp: Date;
  title?: string;
}

export class ExternalAPIClient {
  private readonly timeout: number;

  constructor() {
    this.timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT || "5000");
  }

  /**
   * Pencarian keyword yang mengintegrasikan multiple external APIs
   */
  async keywordSearch(
    query: string,
    limit: number = 20
  ): Promise<ExternalDocument[]> {
    const documents: ExternalDocument[] = [];
    const lowerQuery = query.toLowerCase();

    try {
      // Parallel fetch dari berbagai API berdasarkan keyword detection
      const promises: Promise<ExternalDocument[]>[] = [];

      // Weather-related queries
      if (this.isWeatherQuery(lowerQuery)) {
        console.log(
          "[API CLIENT] Detected weather query, fetching weather data..."
        );
        promises.push(this.fetchWeatherData(query));
      }

      // News-related queries
      if (this.isNewsQuery(lowerQuery)) {
        console.log("[API CLIENT] Detected news query, fetching news data...");
        promises.push(this.fetchNewsData(query));
      }

      // Holiday-related queries
      if (this.isHolidayQuery(lowerQuery)) {
        console.log(
          "[API CLIENT] Detected holiday query, fetching holiday data..."
        );
        promises.push(this.fetchHolidayData());
      }

      // Country/location queries
      if (this.isCountryQuery(lowerQuery)) {
        console.log(
          "[API CLIENT] Detected country query, fetching country data..."
        );
        promises.push(this.fetchCountryData(query));
      }

      if (promises.length === 0) {
        console.log(
          "[API CLIENT] No external API queries detected for:",
          query
        );
        return [];
      }

      // Execute all promises
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(
            `[API CLIENT] Promise ${index} fulfilled with ${result.value.length} results`
          );
          documents.push(...result.value);
        } else {
          console.error(
            `[API CLIENT] Promise ${index} rejected:`,
            result.reason
          );
        }
      });

      console.log(`[API CLIENT] Total documents fetched: ${documents.length}`);
      return documents.slice(0, limit);
    } catch (error) {
      console.error("[API CLIENT] Error in keyword search:", error);
      return [];
    }
  }

  /**
   * Fetch weather data from OpenWeatherMap
   */
  private async fetchWeatherData(query: string): Promise<ExternalDocument[]> {
    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        console.log("[API CLIENT] OpenWeather API key not configured");
        return [];
      }

      // Extract city from query (default to Madiun for your use case)
      const city = this.extractCityFromQuery(query) || "Madiun";
      const url = `${
        process.env.OPENWEATHER_BASE_URL
      }/weather?q=${encodeURIComponent(
        city
      )}&appid=${apiKey}&units=metric&lang=id`;

      console.log("[API CLIENT] Fetching weather for city:", city);

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        console.error(
          `[API CLIENT] Weather API error: ${response.status} ${response.statusText}`
        );
        return [];
      }

      const data = await response.json();
      console.log(
        "[API CLIENT] Weather data received:",
        data.name,
        data.weather[0].description
      );

      const content = `Cuaca di ${data.name}: ${data.weather[0].description}, suhu ${data.main.temp}°C, terasa seperti ${data.main.feels_like}°C. Kelembaban ${data.main.humidity}%, tekanan ${data.main.pressure} hPa. Kecepatan angin ${data.wind.speed} m/s.`;

      return [
        {
          id: `weather_${data.name}_${Date.now()}`,
          content,
          source: "openweather",
          metadata: data,
          timestamp: new Date(),
        },
      ];
    } catch (error) {
      console.error("[API CLIENT] Weather API error:", error);
      return [];
    }
  }

  /**
   * Fetch news data from News API
   */
  private async fetchNewsData(query: string): Promise<ExternalDocument[]> {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        console.log("[API CLIENT] News API key not configured");
        return [];
      }

      const searchTerm = this.extractNewsKeywords(query);
      const url = `${
        process.env.NEWS_API_BASE_URL
      }/everything?q=${encodeURIComponent(
        searchTerm
      )}&language=id&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        console.error(`[API CLIENT] News API error: ${response.status}`);
        return [];
      }

      const data = await response.json();

      return data.articles.map((article: any, index: number) => ({
        id: `news_${Date.now()}_${index}`,
        content: `${article.title}. ${article.description || ""}. Sumber: ${
          article.source.name
        }. Dipublikasikan: ${new Date(article.publishedAt).toLocaleDateString(
          "id-ID"
        )}.`,
        source: "newsapi",
        metadata: article,
        timestamp: new Date(),
      }));
    } catch (error) {
      console.error("[API CLIENT] News API error:", error);
      return [];
    }
  }

  /**
   * Fetch holiday data from public API
   */
  private async fetchHolidayData(): Promise<ExternalDocument[]> {
    try {
      const year = new Date().getFullYear();
      const url = `${process.env.PUBLIC_HOLIDAYS_BASE_URL}/PublicHolidays/${year}/ID`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        console.error(`[API CLIENT] Holiday API error: ${response.status}`);
        return [];
      }

      const holidays = await response.json();

      return holidays.map((holiday: any, index: number) => ({
        id: `holiday_${year}_${index}`,
        content: `Hari libur nasional: ${
          holiday.localName
        } pada tanggal ${new Date(holiday.date).toLocaleDateString("id-ID")}. ${
          holiday.name
        }.`,
        source: "public-holidays",
        metadata: holiday,
        timestamp: new Date(),
      }));
    } catch (error) {
      console.error("[API CLIENT] Holiday API error:", error);
      return [];
    }
  }

  /**
   * Fetch country data from REST Countries API
   */
  private async fetchCountryData(query: string): Promise<ExternalDocument[]> {
    try {
      const country = this.extractCountryFromQuery(query) || "Indonesia";
      const url = `${
        process.env.REST_COUNTRIES_BASE_URL
      }/name/${encodeURIComponent(country)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        console.error(`[API CLIENT] Countries API error: ${response.status}`);
        return [];
      }

      const countries = await response.json();

      return countries.slice(0, 2).map((country: any, index: number) => ({
        id: `country_${country.cca3}_${index}`,
        content: `Informasi ${country.name.common}: Ibukota ${
          country.capital?.[0] || "tidak diketahui"
        }, populasi ${
          country.population?.toLocaleString("id-ID") || "tidak diketahui"
        }, mata uang ${
          Object.values(country.currencies || {})[0]?.name || "tidak diketahui"
        }, bahasa resmi ${Object.values(country.languages || {}).join(", ")}.`,
        source: "restcountries",
        metadata: country,
        timestamp: new Date(),
      }));
    } catch (error) {
      console.error("[API CLIENT] Countries API error:", error);
      return [];
    }
  }

  // Helper methods for query classification
  private isWeatherQuery(query: string): boolean {
    const weatherKeywords = [
      "cuaca",
      "weather",
      "suhu",
      "hujan",
      "panas",
      "dingin",
      "iklim",
      "temperature",
    ];
    const hasWeatherKeyword = weatherKeywords.some((keyword) =>
      query.includes(keyword)
    );
    console.log(
      `[API CLIENT] Weather query check: "${query}" -> ${hasWeatherKeyword}`
    );
    return hasWeatherKeyword;
  }

  private isNewsQuery(query: string): boolean {
    const newsKeywords = [
      "berita",
      "news",
      "informasi",
      "terbaru",
      "update",
      "kabar",
      "trending",
    ];
    return newsKeywords.some((keyword) => query.includes(keyword));
  }

  private isHolidayQuery(query: string): boolean {
    const holidayKeywords = [
      "libur",
      "holiday",
      "cuti",
      "hari raya",
      "nasional",
      "idul",
    ];
    return holidayKeywords.some((keyword) => query.includes(keyword));
  }

  private isCountryQuery(query: string): boolean {
    const countryKeywords = [
      "negara",
      "country",
      "indonesia",
      "malaysia",
      "populasi",
      "mata uang",
      "currency",
    ];
    return countryKeywords.some((keyword) => query.includes(keyword));
  }

  private extractCityFromQuery(query: string): string | null {
    const cities = [
      "madiun",
      "surabaya",
      "jakarta",
      "yogyakarta",
      "bandung",
      "medan",
      "semarang",
    ];
    for (const city of cities) {
      if (query.toLowerCase().includes(city)) {
        return city;
      }
    }
    return null;
  }

  private extractNewsKeywords(query: string): string {
    // Extract meaningful keywords for news search
    const stopWords = [
      "apa",
      "yang",
      "adalah",
      "tentang",
      "berita",
      "informasi",
    ];
    const words = query
      .toLowerCase()
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.includes(word));
    return words.join(" ") || "indonesia";
  }

  private extractCountryFromQuery(query: string): string | null {
    const countries = [
      "indonesia",
      "malaysia",
      "singapore",
      "thailand",
      "philippines",
    ];
    for (const country of countries) {
      if (query.toLowerCase().includes(country)) {
        return country;
      }
    }
    return null;
  }
}
