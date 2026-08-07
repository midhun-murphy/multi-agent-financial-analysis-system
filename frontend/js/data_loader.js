/**
 * data_loader.js
 * ==============
 * Responsible for fetching and parsing dashboard.json.
 * Centralizes data access for all widgets.
 */

class DataLoader {
  constructor() {
    this.data = null;
  }

  async load() {
    try {
      const response = await fetch('./data/dashboard.json');
      if (!response.ok) {
        throw new Error(`Failed to load mock data: ${response.statusText}`);
      }
      this.data = await response.json();
      return this.data;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Fallback data structure to prevent completely broken UI in case of fetch issues
      return null;
    }
  }

  getCompanyInfo() {
    return this.data ? this.data.company : {};
  }

  getMetrics() {
    return this.data ? this.data.metrics : {};
  }

  getPerformanceTrend() {
    return this.data ? this.data.performance_trend : {};
  }

  getHealthBreakdown() {
    return this.data ? this.data.health_breakdown : {};
  }

  getRisk() {
    return this.data ? this.data.risk : {};
  }

  getCompetitors() {
    return this.data ? this.data.competitors : [];
  }

  getSwot() {
    return this.data ? this.data.swot : {};
  }

  getNews() {
    return this.data ? this.data.news : {};
  }

  getInvestment() {
    return this.data ? this.data.investment : {};
  }

  getExecutiveSummary() {
    return this.data ? this.data.executive_summary : {};
  }

  getConfidenceScores() {
    return this.data ? this.data.confidence_scores : {};
  }

  getChatSuggestions() {
    return this.data ? this.data.chat_suggestions : [];
  }
}

// Export DataLoader instance
export const dataLoader = new DataLoader();
export default dataLoader;
