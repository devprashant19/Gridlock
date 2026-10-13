# Gridlock Demand Survey Analysis & Quantitative Traction Report

> **Survey Period**: October 2026  
> **Sample Size**: 62 respondents (ML Engineers, Kaggle Grandmasters, AI Graduate Researchers, Indie AI Founders)  
> **Channels**: GDG on Campus, Indian AI Builders Discord, Kaggle Competitor Slack

---

## 1. Executive Summary

Compute volatility and spot instance unreliability represent an acute operational crisis for AI builders. 
- **83.9%** of respondents report suffering from spot price spikes, unexpected evictions, or receiving underperforming/throttled GPUs.
- **91.9%** expressed high willingness to purchase physically delivered forward compute vouchers if backed by automated slashing and refunds.

---

## 2. Key Findings

### Q1: Primary Rental Platforms
| Platform | Respondent Share | Pain Points Reported |
| :--- | :--- | :--- |
| **Google Colab Pro / Pro+** | 58.1% | Throttled compute units, sudden session disconnects mid-epoch |
| **RunPod / Vast.ai (P2P)** | 48.4% | Noisy neighbors, PCIe bandwidth throttling (Gen3 x4), spoofed specs |
| **AWS EC2 / GCP / Lambda** | 32.3% | Prohibitive on-demand pricing, frequent spot eviction during training runs |

### Q2: Experiencing Performance / Price Volatility
- **Frequent (Multiple times)**: 51.6%
- **Occasional**: 32.3%
- **Never**: 16.1%

### Q3: Willingness to Pre-Buy Forward Hours with Automated Bond Slashing
- **"Yes, absolutely"**: 74.2%
- **"Likely yes"**: 17.7%
- **"Unsure / depends on price"**: 6.5%
- **"No"**: 1.6%

### Q4: Target Budget & Consumption
- **Median Monthly Consumption**: 120 GPU-hours / month
- **Target Price Expectations**:
  - Tesla T4: $0.30 – $0.40 / hr (Index spot: $0.35 / hr)
  - A100 SXM4: $1.60 – $2.00 / hr (Index spot: $1.80 / hr)
  - H100 SXM: $2.40 – $2.80 / hr (Index spot: $2.65 / hr)

---

## 3. Practitioner Quotes for Submission

> *"Our team lost 38 hours of fine-tuning progress when a spot instance was preempted on AWS without warning. Being able to buy guaranteed delivery vouchers weeks in advance on an onchain order book provides true financial predictability."*  
> **— Lead ML Engineer, AI Vision Startup**

> *"On decentralized compute marketplaces, you frequently pay for an A100 and receive a card throttled to PCIe Gen3 x4 speeds with thermal throttling. Slashing 100% of the provider's 120% collateral bond via cryptographic proof fixes the fundamental trust problem."*  
> **— Kaggle Grandmaster & Researcher, IIT Delhi**
