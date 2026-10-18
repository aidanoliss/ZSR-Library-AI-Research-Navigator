import test from "node:test";
import assert from "node:assert/strict";
import { assessSourceRequirements } from "../src/sourceAssessment.js";
import { rankSourceResults } from "../server/sourceRelevance.js";
import { groupRelatedSourceResults, uniqueSourceResults } from "../src/sourceDedup.js";
import { sourceResultLanes, paginateSourceLanes, filterSourceResults } from "../src/sourceResultView.js";

// Frozen public-provider metadata from the October 18 librarian audit. No model
// grades or fresh-provider availability are used as test expectations.
const audit = {
  "population-geography-method": [
    {
      "title": "Meta-Analytic Evaluation of Stress Reduction Interventions for Undergraduate and Graduate Students",
      "author": "Yusufov, Miryam; Nicoloro-SantaBarbara, Jennifer et al.",
      "authors": [
        "Yusufov, Miryam",
        "Nicoloro-SantaBarbara, Jennifer",
        "Grey, Natalie E.",
        "Moyer, Anne",
        "Lobel, Marci"
      ],
      "type": "article",
      "date": "2019-05",
      "doi": "10.1037/str0000099",
      "isbn": "",
      "edition": "",
      "containerTitle": "International journal of stress management",
      "pages": "132-145",
      "abstractText": "Growing numbers of students in college or graduate school experience high stress, resulting in adverse emotional, academic, and health outcomes. A variety of stress reduction interventions have been used with students, but their effectiveness has not been systematically examined. We used meta-analysis to evaluate the efficacy of stress reduction interventions for undergraduate and graduate students. Studies (k = 43) that used an appropriate control group and assessed distress before and after intervention were aggregated using a random-effects model. Most studies were conducted in the United States; others were from Asia, Europe, and Australia. Standardized mean gain difference effect sizes were calculated for anxiety and perceived stress for six intervention techniques. Moderators examined included student type (undergraduate and graduate) and duration of intervention. Results indicate that most interventions are effective in decreasing both outcomes in students. Cognitive-behavioral therapy, coping skills, and social support interventions were more effective in reducing perceived stress, whereas relaxation training, mindfulness-based stress reduction, and psychoeducation were more effective in reducing anxiety. Graduate students experienced greater reduction in anxiety than did undergraduates for relaxation training and psychoeducation interventions. Participants in both long- and short-term interventions showed significant reduction in anxiety and perceived stress relative to control groups, but for relaxation training, long-term interventions were more effective in reducing anxiety than were short-term interventions. Although all six techniques were effective in reducing at least one of the stress-related outcomes, the few differences in effectiveness suggest there is value in tailoring interventions toward the particular group and outcome being targeted."
    }
  ],
  "historical-period": [
    {
      "title": "A new phase of activism: women's occupational organisations and married women's paid work after the Second World War in Britain",
      "author": "Glew, Helen",
      "authors": [
        "Glew, Helen"
      ],
      "type": "article",
      "date": "2025-06-07",
      "doi": "10.1080/09612025.2024.2373505",
      "isbn": "",
      "edition": "",
      "containerTitle": "Women's history review",
      "pages": "545-563",
      "abstractText": "Focusing on the National Union of Women Teachers (NUWT) and the National Association of Women Civil Servants (NAWCS), this article looks at activism and campaigning for married women workers after the abolition of the marriage bar in both teaching (1944) and the Civil Service (1946). The article outlines the types of campaigning undertaken as well as the philosophical and ideological underpinnings in envisioning the married woman worker. Finally, the article places the campaigning both in the context of these two organisations' longer histories and the distinctiveness of the late 1940s and 1950s in the history of (married) women's employment in Britain."
    },
    {
      "title": "Jericho’s Daughters: Feminist Historiography and Class Resistance in Pip Williams’ The Bookbinder of Jericho",
      "author": "Rabinovich, Irina",
      "authors": [
        "Rabinovich, Irina"
      ],
      "type": "article",
      "date": "2025-07-01",
      "doi": "10.3390/h14070138",
      "isbn": "",
      "edition": "",
      "containerTitle": "Humanities (Basel)",
      "pages": "138-",
      "abstractText": "This article examines the intersecting forces of gender, class, and education in early twentieth-century Britain through a feminist reading of Pip Williams’ historical novel The Bookbinder of Jericho. Centering on the fictional character Peggy Jones—a working-class young woman employed in the Oxford University Press bindery—the study explores how women’s intellectual ambitions were constrained by economic hardship, institutional gatekeeping, and patriarchal social norms. By integrating close literary analysis with historical research on women bookbinders, educational reform, and the impact of World War I, the paper reveals how the novel functions as both a narrative of personal development and a broader critique of systemic exclusion. Drawing on the genre of the female Bildungsroman, the article argues that Peggy’s journey—from bindery worker to aspiring scholar—mirrors the real struggles of working-class women who sought education and recognition in a male-dominated society. It also highlights the significance of female solidarity, especially among those who served as volunteers, caregivers, and community organizers during wartime. Through the symbolic geography of Oxford and its working-class district of Jericho, the novel foregrounds the spatial and social divides that shaped women’s lives and labor. Ultimately, this study shows how The Bookbinder of Jericho offers not only a fictional portrait of one woman’s aspirations but also a feminist intervention that recovers and reinterprets the overlooked histories of British women workers. The novel becomes a literary space for reclaiming agency, articulating resistance, and criticizing the gendered boundaries of knowledge, work, and belonging."
    },
    {
      "title": "Chemical ‘canaries’: Munitions workers in the First World War",
      "author": "Patricia Fara",
      "authors": [
        "Patricia Fara"
      ],
      "type": "journal article",
      "date": "2023-6-2",
      "doi": "10.1177/00732753231173063",
      "isbn": "",
      "edition": "",
      "containerTitle": "History of Science",
      "pages": "546-560",
      "abstractText": "In the early twentieth century, scientific innovations permanently changed international warfare. As chemicals traveled out of laboratories into factories and military locations, war became waged at home as well as overseas. Large numbers of women were employed in munitions factories during the First World War, but their public memories have been overshadowed by men who died on battlefields abroad; they have also been ignored in traditional histories of chemistry that focus on laboratory-based research. Mostly young and poorly educated, but crucial for Britain’s military success, these female workers were subjected to procedures of social regulation and consigned to carrying out dangerous chemical procedures causing chronic illness or death; in particular, when TNT died their skin yellow, they were colloquially known as 'canaries.'"
    },
    {
      "title": "Women and the ACT, 1933–59",
      "author": "Galt, Frances C",
      "authors": [
        "Galt, Frances C"
      ],
      "type": "book_chapter",
      "date": "2020-11-27",
      "doi": "10.1332/policypress/9781529206296.003.0002",
      "isbn": "1529206294",
      "edition": "",
      "containerTitle": "Women's Activism Behind the Screens",
      "pages": "",
      "abstractText": "This chapter examines the relationship between women and the Association of Cine-Technicians (ACT) in the first three decades of the union’s history, between 1933 and 1959, to argue that a profoundly gendered union structure was institutionalised during the ACT’s establishment and formative years. Firstly, this chapter examines the process of unionisation within the British film industry to demonstrate that men’s interests were prioritised and women’s interests were excluded by this process. Secondly, this chapter reflects upon the consolidation of the ACT’s power in the film industry and its gendered union structure during the Second World War. It argues that the ACT introduced agreements and adopted organisational practices which safeguarded men’s jobs in response to the influx of women workers into the film industry during the war. Thirdly, it examines debates around which technicians should be represented among ACT’s membership in the post-war period, including the union’s response to the growth of the commercial television industry in the 1950s. This chapter also surveys women’s activity in the ACT between 1933 and 1959 to consider the evidence for a feminist consciousness among women activists in the decades between Britain’s first and second-wave feminist movements."
    },
    {
      "title": "Women and the ACT, 1933-59",
      "author": "Galt, Frances C.",
      "authors": [
        "Galt, Frances C."
      ],
      "type": "book_chapter",
      "date": "2021-11-27",
      "doi": "10.51952/9781529206302.ch001",
      "isbn": "1529206294",
      "edition": "",
      "containerTitle": "Women's Activism Behind the Screens",
      "pages": "27-62",
      "abstractText": "This chapter examines the relationship between women and the Association of Cine-Technicians (ACT) in the first three decades of the union's history, between 1933 and 1959, to argue that a profoundly gendered union structure was institutionalised during the ACT's establishment and formative years. Firstly, this chapter examines the process of unionisation within the British film industry to demonstrate that men's interests were prioritised and women's interests were excluded by this process. Secondly, this chapter reflects upon the consolidation of the ACT's power in the film industry and its gendered union structure during the Second World War. It argues that the ACT introduced agreements and adopted organisational practices which safeguarded men's jobs in response to the influx of women workers into the film industry during the war. Thirdly, it examines debates around which technicians should be represented among ACT's membership in the post-war period, including the union's response to the growth of the commercial television industry in the 1950s. This chapter also surveys women's activity in the ACT between 1933 and 1959 to consider the evidence for a feminist consciousness among women activists in the decades between Britain's first and second-wave feminist movements."
    },
    {
      "title": "‘I think I was the only Chinese girl working there’: Race and gender in the chocolate factory",
      "author": "Robertson, Emma",
      "authors": [
        "Robertson, Emma"
      ],
      "type": "book_chapter",
      "date": "2026-03-28",
      "doi": "10.7765/9781526118615.00013",
      "isbn": "",
      "edition": "",
      "containerTitle": "Chocolate, women and empire",
      "pages": "178-221",
      "abstractText": "This chapter focuses on the experiences of women workers on the shopfloor of the Rowntree factory in York. It now turns to Rowntree employees daily lives at the factory to reach a better understanding of how women experienced their gendered roles in chocolate manufacture. The chapter presents case studies of three non-white women who migrated to the city. The first, Nellie, was born in Liverpool to Chinese parents, and moved to York during the Second World War. Carmen was recruited directly by Rowntree in Malta, arriving in York in the early 1960s. Finally, Julie travelled to York with her family in the early 1970s as a Ugandan Asian refugee and started work at Rowntree a year later. The work of Nellie, Carmen and Julie illustrates the ways in which the Rowntree firm is implicated in imperial and postcolonial histories, and in the wider story of race relations in Britain."
    }
  ],
  "known-book": [
    {
      "title": "Governing the commons : the evolution of institutions for collective action",
      "author": "Ostrom, Elinor",
      "authors": [
        "Ostrom, Elinor"
      ],
      "type": "book",
      "date": "2015",
      "doi": "",
      "isbn": "9781316423936",
      "edition": "",
      "containerTitle": "Governing the commons : the evolution of institutions for collective action",
      "pages": "",
      "abstractText": "The governance of natural resources used by many individuals in common is an issue of increasing concern to policy analysts. Both state control and privatization of resources have been advocated, but neither the state nor the market have been uniformly successful in solving common pool resource problems. After critiquing the foundations of policy analysis as applied to natural resources, Elinor Ostrom here provides a unique body of empirical data to explore conditions under which common pool resource problems have been satisfactorily or unsatisfactorily solved. Dr Ostrom uses institutional analysis to explore different ways - both successful and unsuccessful - of governing the commons. In contrast to the proposition of the 'tragedy of the commons' argument, common pool problems sometimes are solved by voluntary organizations rather than by a coercive state. Among the cases considered are communal tenure in meadows and forests, irrigation communities and other water rights, and fisheries."
    },
    {
      "title": "Governing the commons : the evolution of institutions for collective action",
      "author": "Ostrom, Elinor.",
      "authors": [
        "Ostrom, Elinor."
      ],
      "type": "book",
      "date": "1990",
      "doi": "",
      "isbn": "0521371015",
      "edition": "",
      "containerTitle": "Governing the commons : the evolution of institutions for collective action",
      "pages": "",
      "abstractText": ""
    },
    {
      "title": "Balancing the commons in Switzerland : institutional transformations and sustainable innovations",
      "author": "Haller, Tobias",
      "authors": [
        "Haller, Tobias"
      ],
      "type": "book",
      "date": "2021",
      "doi": "",
      "isbn": "9781003043263",
      "edition": "1st ed.",
      "containerTitle": "Balancing the commons in Switzerland : institutional transformations and sustainable innovations",
      "pages": "",
      "abstractText": "Balancing the Commons in Switzerland outlines continuity and change in the management of common-pool resources such as pastures and forests in Switzerland. The book focusses on the differences and similarities between local institutions (rules and regulations) and forms of commoners' organisations (civic communities, corporations) which have managed common property for several centuries and have shaped the cultural landscapes of Switzerland. The core of the book are five case studies from the German, French and Italian speaking regions of Switzerland. Beginning in the late medieval ages and focussing on the transformations in the 19th and 20th century, it traces the internal and external political, economic and societal changes and examines what impact these changes had on commoners. It goes beyond the work of Robert Netting and Elinor Ostrom, who discussed Swiss commons as a unique case of robustness, by analysing how local commoners reacted to, but also shaped changes by adapting and transforming common property institutions. Thus, the volume highlights how institutional changes in the management of the commons (pastures, forest) on the local level are embedded in the public policies of the respective cantons (provinces), and the state, which generates a high heterogeneity and an actual laboratory situation (Swiss lab). It shows the very different ways that local collective organisations and their members have followed in order to try to cope with the loss of value of the commons and the increased workload for maintaining common property management. Providing insightful case studies of commons management, this volume delivers lessons to be learned for the commons worldwide and for the general theoretical debate on the commons. It is published on the 30th anniversary of Ostrom's Nobel Prize winning title Governing the Commons from which it gets its name. This book will be of great interest to students and scholars of the commons, natural resource management and agricultural development."
    }
  ],
  "nursing-review": [
    {
      "title": "Effectiveness of Nurse-Led Telemonitoring Versus Usual Care on Readmission and Mortality Rates in Patients With Chronic Heart Failure",
      "author": "Lei Xiao; Jingqiao Tao et al.",
      "authors": [
        "Lei Xiao",
        "Jingqiao Tao",
        "Li Yao",
        "Yanyan Sun",
        "Fangqing Chen",
        "Hong Zhou"
      ],
      "type": "journal article",
      "date": "2026-7-7",
      "doi": "10.1097/jcn.0000000000001344",
      "isbn": "",
      "edition": "",
      "containerTitle": "Journal of Cardiovascular Nursing",
      "pages": "E556-E570",
      "abstractText": "Background: Chronic heart failure (HF) is associated with frequent rehospitalization. Nurse-led telemonitoring uses remote capture of weight, blood pressure, heart rate, and symptoms, with nurse review and escalation. We evaluated whether nurse-led telemonitoring improves outcomes versus usual care. Objective: In this study, we aimed to assess whether nurse-led telemonitoring, compared with usual care, improves clinical outcomes in adults with chronic heart failure, particularly hospital readmissions and mortality. Methods: Following Preferred Reporting Items for Systematic Reviews and Meta-Analyses 2020, we searched PubMed, Embase, CINAHL, and Cochrane Library from January 1, 2015, to May 31, 2025. Randomized trials and observational cohorts comparing nurse-led telemonitoring with usual care in adults with HF were eligible. Two reviewers independently screened records, extracted data using a piloted form, and assessed risk of bias (Cochrane RoB 2.0; RoBINS-I). Primary outcomes were all-cause and heart-failure readmissions and mortality. Random-effects meta-analyses were conducted; heterogeneity and small-study effects were examined. Results: Eighteen studies met criteria (11 randomized trials; 7 cohorts; about 20,000 participants). Interventions typically combined daily remote measurements with proactive nurse follow-up. Compared with usual care, telemonitoring reduced all-cause readmissions and heart-failure readmissions. Pooled mortality in randomized trials showed a nonsignificant trend favoring telemonitoring, while large real-world cohorts showed lower 1-year mortality among telemonitored patients. Risk of bias was low to moderate, with performance bias common due to the nature of the intervention. Conclusions: Nurse-led telemonitoring is associated with fewer hospital readmissions and signals toward improved survival. Programs that include active nurse engagement and timely response to alerts appear most effective. Further adequately powered trials with longer follow-up and standardized intervention components are needed."
    },
    {
      "title": "Technology-supported nurse-led transitional interventions to improve self-care in heart failure patients after hospital discharge: a systematic review and meta-analysis of randomized controlled trials",
      "author": "Ismail Fahmi; Tuti Herawati et al.",
      "authors": [
        "Ismail Fahmi",
        "Tuti Herawati",
        "Imami Nur Rachmawati",
        "Amelia Ganefianty",
        "Bambang Budi Siswanto",
        "Simon Stewart"
      ],
      "type": "journal article",
      "date": "2026-6-30",
      "doi": "10.1093/eurjcn/zvag159",
      "isbn": "",
      "edition": "",
      "containerTitle": "European Journal of Cardiovascular Nursing",
      "pages": "",
      "abstractText": "Abstract Aims To assess the evidence supporting the implementation of technology-supported nurse-led transitional interventions to improve the self-care of patients discharged from hospital with heart failure (HF) and at high risk of poor health outcomes. Methods and results We followed PRISMA guidelines, searching PubMed, Scopus, Web of Science, EMBASE, ScienceDirect, CINAHL, Clinical Key, Cochrane CENTRAL, ClinicalTrials.gov, and Google Scholar for randomized controlled trials (RCTs) comparing post-discharge, nurse-led, technology-based self-care programmes (e.g. telehealth education, mobile apps) vs. usual care applied to adult HF patients. The main outcome measure was the Self-Care of Heart Failure Index (SCHFI). Data was pooled in RevMan 5.4.1 using random effects. Overall, 9 RCTs comprising 952 participants with a mean age ∼59–78 years, 65% male and most NYHA Class II-III were included. Seven trials applied telephone-based support, one a mobile health (mHealth) app, and the other an avatar-based app. Intervention content included structured education, motivational interviewing, and symptom monitoring. Technology-based, nurse-delivered interventions were associated with improvements in self-care maintenance (SMD = 0.97; 95% CI: 0.57–1.37), self-care management (SMD = 0.84; 95% CI: 0.40–1.28), and self-care confidence (SMD = 0.80; 95% CI: 0.47–1.13). However, heterogeneity was consistently high across all outcomes (I2 = 82–90%). Most included studies used telephone-based interventions, while evidence for mHealth and avatar-based approaches was limited. Conclusion Nurse-led interventions delivered through technological platforms may improve self-care outcomes in post-discharge heart failure patients. However, high heterogeneity, variability in intervention design, and limited evidence for advanced digital technologies restrict the certainty and generalizability of these findings. Registration PROSPERO CRD42025633134"
    }
  ],
  "science-review": [
    {
      "title": "Offshore wind farm impacts on marine fauna across taxa and ecological levels: A global review",
      "author": "Gabriella La Manna; Mariangela Moro Merella et al.",
      "authors": [
        "Gabriella La Manna",
        "Mariangela Moro Merella",
        "Alessia Crobu",
        "Arianna Pansini",
        "Giulia Ceccherelli"
      ],
      "type": "article",
      "date": "2026-11-01",
      "doi": "10.1016/j.isci.2026.117814",
      "isbn": "",
      "edition": "",
      "containerTitle": "iScience",
      "pages": "117814-",
      "abstractText": "The expansion of offshore wind farms (OWFs) is central to global decarbonization strategies, yet their effects on marine biodiversity are only partially understood. This systematic review synthesizes 221 publications up to June 2025 to assess the ecological impacts of OWFs on marine fauna living below the sea surface. The evidence base is uneven, heavily focused on North European waters, fish, and invertebrates, while expanding OWF regions and marine mammals remain underrepresented. Most studies examine short-term, individual-level responses, limiting inference on long-term effects. Impacts vary widely by stressor, taxon, and biological outcome. Invertebrates often show positive responses linked to reef effects, though key functional traits are vulnerable. Fish responses are largely neutral except under noise, while marine mammals exhibit the most consistent negative impacts. The impact score developed here highlights taxon-specific vulnerability and offers a scalable risk-assessment tool for data-poor regions. The review calls for standardized, long-term field monitoring to support OWF expansion while safeguarding biodiversity."
    },
    {
      "title": "Marine biodiversity impact pathways for offshore wind farm decommissioning: Implications for Life Cycle impact assessment development",
      "author": "Liv Stranddorf; Tracey Colley et al.",
      "authors": [
        "Liv Stranddorf",
        "Tracey Colley",
        "Matthieu Delefosse",
        "Jon C. Svendsen",
        "Stig Irving Olsen"
      ],
      "type": "journal article",
      "date": "2024-10",
      "doi": "10.1016/j.ecolind.2024.112613",
      "isbn": "",
      "edition": "",
      "containerTitle": "Ecological Indicators",
      "pages": "112613",
      "abstractText": ""
    },
    {
      "title": "SPECIES DIVERSITY AND SPATIAL DISTRIBUTION OF MARINE MAMMALS RECORDED IN AREAS PROPOSED FOR OFFSHORE WIND FARMS IN BRAZIL",
      "author": "Stella Almeida Lima; Ana Emília Barboza de Alencar et al.",
      "authors": [
        "Stella Almeida Lima",
        "Ana Emília Barboza de Alencar",
        "Fernanda Loffler Niemeyer Attademo",
        "Flávio José de Lima Silva",
        "Jorge Eduardo Lins Oliveira"
      ],
      "type": "journal article",
      "date": "2026-8-21",
      "doi": "10.23900/artefactum.v25i7.3637",
      "isbn": "",
      "edition": "",
      "containerTitle": "Artefactum - revista de estudos interdisciplinares",
      "pages": "e3637",
      "abstractText": "The expansion of offshore wind energy in Brazil has increased the need to assess potential interactions between marine infrastructure and biodiversity. This study aimed to identify species diversity and analyze the spatial distribution of marine mammals recorded in areas targeted for offshore wind farm development along the coast of Rio Grande do Norte, northeastern Brazil. Data from five environmental monitoring programs were integrated, including stranding records, vessel-based visual surveys, and passive acoustic monitoring, totaling 1,038 records. Nineteen species belonging to the orders Cetartiodactyla and Sirenia were identified, representing five families and 14 genera. Odontocete cetaceans predominated and included coastal, oceanic, and deep-water species, with records of threatened taxa such as Balaenoptera musculus, Trichechus manatus, Sotalia guianensis, and Physeter macrocephalus. Spatial analyses revealed substantial overlap between proposed offshore wind development areas and habitats used by marine mammals. The findings highlight the importance of incorporating ecological criteria, long-term monitoring, and precautionary approaches into environmental planning and licensing processes to support sustainable offshore wind development while promoting marine biodiversity conservation."
    },
    {
      "title": "Metagenomic biodiversity assessment within an offshore wind farm",
      "author": "Phanu Theodore Serivichyaswat; Thijs Scholte et al.",
      "authors": [
        "Phanu Theodore Serivichyaswat",
        "Thijs Scholte",
        "Tim Wilms",
        "Liv Stranddorf",
        "Tom van der Valk"
      ],
      "type": "journal article",
      "date": "2025-5-14",
      "doi": "10.1038/s41598-025-01541-x",
      "isbn": "",
      "edition": "",
      "containerTitle": "Scientific Reports",
      "pages": "",
      "abstractText": "Abstract Environmental DNA (eDNA) analysis can be a powerful tool for monitoring biodiversity and assessing human impacts on ecosystems. In this study, we employed a genome-wide metagenomic eDNA approach to assess the marine biodiversity within and around the Horns Rev 1 offshore wind farm in the Danish North Sea. Seawater samples were collected from both within the windfarm and surrounding control sites, sequenced, and analyzed using a combination of DNA k-mer matching and alignment-based classification methods. We identified a wide range of species across the tree of life—highlighting the species richness of this marine ecosystem. Our results revealed a high degree of species diversity congruence between the wind farm and control sites. While this could suggest minimal ecological disruption of the wind farm, we cannot rule out that the influence of ocean currents and water mixing the DNA from different regions dominate the species detection. We detected bioindicator species, such as Thalassiosira, Phaeocystis and Skeletonema , which can provide insights into water quality. Our metagenomic approach also enabled us to obtain population genomics insights for species, such as the European anchovy ( Engraulis encrasicolus ) and the diatom Rhizosolenia setigera , and genetically confirmed the origin of the invasive Sea walnut ( Mnemiopsis leidyi ) in the North Sea. This study highlights the potential of genome-wide eDNA metagenomics as a framework for assessing marine biodiversity and detecting population-level genetic signals, contributing to informed and scalable ecosystem monitoring strategies."
    },
    {
      "title": "The global impact of offshore wind farms on ecosystem services",
      "author": "Watson, Stephen C.L.; Somerfield, Paul J. et al.",
      "authors": [
        "Watson, Stephen C.L.",
        "Somerfield, Paul J.",
        "Lemasson, Anaëlle J.",
        "Knights, Antony M.",
        "Edwards-Jones, Andrew",
        "Nunes, Joana",
        "Pascoe, Christine",
        "McNeill, Caroline Louise",
        "Schratzberger, Michaela",
        "Thompson, Murray S.A.",
        "Couce, Elena",
        "Szostek, Claire L.",
        "Baxter, Heather",
        "Beaumont, Nicola J."
      ],
      "type": "article",
      "date": "2024-03-01",
      "doi": "10.1016/j.ocecoaman.2024.107023",
      "isbn": "",
      "edition": "",
      "containerTitle": "Ocean & coastal management",
      "pages": "107023-",
      "abstractText": "Understanding the global impact of offshore wind farms (OWF) on biodiversity and ecosystem services (ES) is crucial in developing sustainable energy transition pathways. This study takes a holistic approach, coupling a semi-systematic review with a novel analytical methodology, to consider the consequences of construction & operation of OWF deployment on biodiversity and ES. 314 pieces of evidence taken from 132 peer-reviewed studies provide the basis to determine the ecological and ES impacts. The process showed that construction impacts were predominantly negative across the ecological subject groups (52%), compared with positive impacts (8%) with several species of fish (e.g. brill, cod, dab, plaice) and some species of birds (e.g. common guillemot, northern fulmar, redhead) showing strongly negative trends. Operational phase impacts were more variable and could be either negative (32%) or positive (34%) depending on site specific conditions. More detailed investigations into fish, shellfish, humans and air-surface studies recorded a net positive effect of wind farm operations on these subject groups. Translation into ES outcomes identified that 14 ES are impacted by the construction and operation of OWF. The most substantially enhanced ES included effects on commercial fisheries and experiential recreation. Social acceptance toward new and hypothetical OWF was also strongly positive, irrespective of country location. Negative effects on ES, including existence values for culturally important groups, e.g., marine mammals and birds and the spread of non-native species, are potentially of most significance. Overall, this study finds more than 86% of possible offshore wind farm impacts on ES are still unknown. There was also a paucity of studies on the decommissioning of OWF and the impacts of deeper-water floating structures, with a bias in studies toward northern hemisphere and developed countries."
    }
  ],
  "geography-method": [
    {
      "title": "Socioeconomic consequences of climate induced human displacement and migration in Bangladesh",
      "author": "M Rezaul Islam; M Shamsuddoha",
      "authors": [
        "M Rezaul Islam",
        "M Shamsuddoha"
      ],
      "type": "journal article",
      "date": "2017-2-1",
      "doi": "10.1177/0268580917693173",
      "isbn": "",
      "edition": "",
      "containerTitle": "International Sociology",
      "pages": "277-298",
      "abstractText": "The main objective of this study was to explore the types and nature of climate induced human displacement and migration, and their socioeconomic consequences in the agro-ecological zones of Bangladesh. The study followed a qualitative research design, where six agro-ecological zones were selected purposively from different parts of Bangladesh. A multi-method data collection method was applied, where the study conducted six participatory rural appraisals (PRAs), eight focus group discussions (FGDs), 24 key informant interviews (KIIs) and 12 in-depth case studies. Data were collected in 2012, and the study used a thematic approach for data analysis. Results showed that the dramatic onset disasters usually caused mass displacement, while the slow onset disasters affected the environment, local ecosystem services and employment opportunities that forced people to undergo routine economic migration at first, followed later by permanent migration. This permanent migration had long-term negative consequences on their livelihoods in terms of poverty, and especially for women, the elderly and those with a disability. It is concluded that while the study focuses on Bangladesh, the implications are international in scope. The findings serve as important guidelines to policy makers, disaster managers and development practitioners."
    },
    {
      "title": "Climate refugees or labour migrants? climate reductive translations of women’s migration from coastal Bangladesh",
      "author": "Camelia Dewan",
      "authors": [
        "Camelia Dewan"
      ],
      "type": "journal article",
      "date": "2023-3-29",
      "doi": "10.1080/03066150.2023.2195555",
      "isbn": "",
      "edition": "",
      "containerTitle": "The Journal of Peasant Studies",
      "pages": "2339-2360",
      "abstractText": ""
    },
    {
      "title": "Impacts of Climate Change Induced Migration on Gender: A Qualitative Study from the Southwest Coastal Region of Bangladesh",
      "author": "Ishita Shahid Sams",
      "authors": [
        "Ishita Shahid Sams"
      ],
      "type": "journal article",
      "date": "2019-6-24",
      "doi": "10.11114/ijsss.v7i4.4292",
      "isbn": "",
      "edition": "",
      "containerTitle": "International Journal of Social Science Studies",
      "pages": "57",
      "abstractText": "The aim of this study is to explore the gender variation of the impact of climate change induced migration. This paper highlights the gender dimensions of climate change induced migration where gender is a vital element for determining vulnerability to climate change which influences the subsequent migration. Actually, the impacts of climate change induced natural disasters are not gender neutral because the experiences, needs and priorities of the climate migrants are varied by gender roles and position. In this research, we explore the socioeconomic impacts of the climate migrants on gender from the evidence of the southwest coastal women and men of Bangladesh. The qualitative data were collected from the cyclone-affected migrants who were migrated internally from the disaster-prone southwest coastal region and lived in the city slums of Khulna in Bangladesh. This study is described the gender differentiation between women and men in case of climate change induced migration according to social, economical, ecological, organizational, occupational, educational and physical aspects which tend to be highly gendered. The study results show that among climate migrants, women are more vulnerable than men due to their socioeconomic condition and gender discrimination in the patriarchal society of Bangladesh who are likely to be poorer, less educated, have a lower social status and have limited access to and control over natural resources."
    },
    {
      "title": "Waiting for the wave, but missing the tide: Case studies of climate-related (im)mobility and health",
      "author": "McMichael, Celia; Schwerdtle, Patricia Nayna et al.",
      "authors": [
        "McMichael, Celia",
        "Schwerdtle, Patricia Nayna",
        "Ayeb-Karlsson, Sonja"
      ],
      "type": "article",
      "date": "2023-01-01",
      "doi": "10.1016/j.jmh.2022.100147",
      "isbn": "",
      "edition": "",
      "containerTitle": "Journal of Migration and Health",
      "pages": "100147-100147",
      "abstractText": "Climate change amplifies health risks, including through the health impacts of climate-related displacement. Yet diverse mobility responses in a warming world can also provide a pathway for climate change adaptation. This article examines the connections between climatic and environmental change, human mobility and health. It presents case studies across three countries: Fiji, Bangladesh, and Burkina Faso. All case studies used qualitative methods, including semi-structured interviews, storytelling, and group discussions. The Fiji case study focuses on relocation of a coastal village exposed to erosion, flooding and saltwater intrusion; it highlights self-reported health risks and opportunities following relocation. The Bangladesh case study includes seven sites that variously experience flooding, cyclones and riverbank erosion; while residents use migration and (im)mobility as a coping strategy, there are associated health risks, particularly for those who feel trapped in new sites of residence. The case study from a village in Burkina Faso examines seasonal labour migration to the Ivory Coast and Mali during times of drought and reduced agricultural productivity, and discusses health risks for men who migrate and for women who remain in sending communities. These case studies illustrate that there is no consistent figure that represents a 'climate migrant', ‘climate refugee’, or ‘trapped’ person. Accordingly, we argue that where planetary health looks to highlight ‘waves’ of climate displacement, it may miss the ‘tide’ of slower onset climatic changes and smaller-scale and diverse forms of (im)mobility. However, even where climate-related mobility is broadly adaptive - e.g. providing opportunities for livelihood diversification, or migration away from environmental risks - there can be health risks and opportunities that are shaped by socio-political contexts, access to healthcare, altered food sources, and living and working conditions. Responsive solutions are required to protect and promote the health of mobile and immobile populations in a warming world."
    }
  ]
};
const check = (source,spec,id) => assessSourceRequirements(source,spec).checks.find(c=>c.id===id);
const method = (name) => ({methodRequirements:{include:[name]}});

test("audited wrong designs are explicit contradictions, not insufficient evidence",()=>{
 assert.equal(assessSourceRequirements(audit["population-geography-method"][0],method("randomized controlled trial")).status,"mismatch");
 for(const index of [2,3]) assert.equal(assessSourceRequirements(audit["science-review"][index],method("systematic review")).status,"mismatch");
 assert.equal(assessSourceRequirements(audit["science-review"][1],method("systematic review")).status,"unverified");
 assert.equal(assessSourceRequirements({abstractText:"We conducted an observational study of 120 patients."},method("randomized controlled trial")).status,"mismatch");
 const spec={...method("systematic review"),concepts:[{preferredTerm:"offshore wind"}]};
 assert.equal(rankSourceResults(audit["science-review"],spec).some(s=>s.title===audit["science-review"][3].title),false);
});
test("audited title and qualitative design formulations provide method evidence",()=>{
 assert.equal(assessSourceRequirements(audit["nursing-review"][1],method("systematic review")).status,"meets");
 assert.equal(assessSourceRequirements(audit["geography-method"][0],method("qualitative interview")).status,"meets");
 assert.equal(assessSourceRequirements({title:"A systematic review and meta-analysis of randomized controlled trials"},method("randomized controlled trial")).status,"mismatch");
 assert.equal(assessSourceRequirements({abstractText:"Samples were collected in an earlier study."},method("systematic review")).status,"unverified");
 assert.equal(assessSourceRequirements({abstractText:"A previous study followed a qualitative research design and conducted key informant interviews."},method("qualitative interview")).status,"unverified");
});
test("K–12 review titles conflict with undergraduate requests and first-year remains narrow",()=>{
 const spec={facets:{population:"undergraduates"}};
 const source={title:"Online Teaching in K-12 Education in the United States: A Systematic Review",type:"article"};
 assert.equal(check(source,spec,"population").status,"mismatch");
 for(const title of ["Teaching online in K12: a systematic review","Teaching online among secondary students"])
  assert.equal(check({title},spec,"population").status,"mismatch",title);
 assert.equal(check({...source,title:"Transitions from K–12 education to college"},spec,"population").status,"unverified");
 const first={facets:{population:"first-year college students"}};
 assert.equal(check({abstractText:"We recruited 50 college students."},first,"population").status,"unverified");
 assert.equal(check({abstractText:"We recruited 50 first-year college students."},first,"population").status,"meets");
 assert.equal(check({abstractText:"We recruited 50 first-year university students."},first,"population").status,"meets");
});
test("WWI historical scope cannot satisfy WWII even in recent publications",()=>{
 const spec={facets:{timePeriod:"1939 to 1945"}};
 for(const index of [1,2]) assert.equal(check(audit["historical-period"][index],spec,"study-period").status,"mismatch");
 assert.equal(check(audit["historical-period"][0],spec,"study-period").status,"unverified","after WWII is not during WWII");
 assert.equal(check({title:"Women workers during World War II"},spec,"study-period").status,"meets");
 assert.notEqual(check({title:"A comparison of World War I and World War II"},spec,"study-period").status,"mismatch");
 assert.equal(check({title:"Women workers",abstractText:"Previous studies examined World War I. This study discusses wartime employment."},spec,"study-period").status,"unverified");
});
test("population and geography require a linked study span instead of country mixing",()=>{
 const spec={facets:{population:"women",geography:"Bangladesh"}};
 assert.equal(check(audit["geography-method"][3],spec,"population-geography").status,"unverified");
 assert.equal(check(audit["geography-method"][1],spec,"population-geography").status,"meets");
 assert.equal(check(audit["geography-method"][1],spec,"geography").status,"meets");
 for(const abstractText of ["We interviewed women in Burkina Faso and men in Bangladesh.","We interviewed women in Burkina Faso. We interviewed men in Bangladesh.","Previous studies interviewed women in Bangladesh.","We recruited women in Bangladesh, whereas other participants lived in Burkina Faso."])
  assert.equal(check({abstractText},spec,"population-geography").status,"unverified",abstractText);
 assert.equal(check({abstractText:"We interviewed 25 women from coastal Bangladesh about migration."},spec,"population-geography").status,"meets");
 const split={title:"Migration",abstractText:"We interviewed 25 women in Burkina Faso. We collected data in Bangladesh."};
 const ranked=rankSourceResults([split],{...spec,concepts:[{preferredTerm:"migration"}]});
 assert.equal(ranked[0].matchExplanation.status,"partial");
 assert.ok(ranked[0].matchExplanation.missingFacets.includes("population–geography relationship"));
});
test("likely editions and chapter versions group without merging citations or identifiers",()=>{
 const books=audit["known-book"];
 const grouped=groupRelatedSourceResults(books);
 assert.equal(grouped.length,2);
 assert.equal(grouped[0].relatedEditions.length,1);
 assert.equal(grouped[0].date,books[0].date);
 assert.equal(grouped[0].relatedEditions[0].date,books[1].date);
 assert.equal(uniqueSourceResults(books).length,3,"identity dedup remains distinct from work grouping");
 const chapters=audit["historical-period"].slice(3,5);
 assert.notEqual(chapters[0].doi,chapters[1].doi);
 assert.equal(groupRelatedSourceResults(chapters).length,1);
 assert.equal(groupRelatedSourceResults(chapters)[0].relatedEditions[0].doi,chapters[1].doi);
 const unrelated={...books[0],author:"Another Author",authors:["Another Author"]};
 assert.equal(groupRelatedSourceResults([books[0],unrelated]).length,2);
 const paged=paginateSourceLanes(sourceResultLanes([...books,...chapters]),{},5);
 assert.equal(paged.flatMap(l=>l.initialResults).length,3,"five-source budget counts grouped works");
 const olderFirst=groupRelatedSourceResults([books[1],books[0]]);
 const eligible=filterSourceResults(olderFirst,{from:"2010"});
 assert.equal(eligible.length,1);
 assert.equal(eligible[0].date,"2015");
 assert.equal(books[0].relatedEditions,undefined,"input records are not mutated");
});


test("deduplication preserves known identity warnings from either provider",()=>{
 const primary={title:"A source title",doi:"10.5555/warning",sourceProvider:"Provider A",identityCheck:{status:"title-matched",registryTitle:"A source title"}};
 const other={title:"A divergent source title",doi:"10.5555/warning",sourceProvider:"Provider B",identityCheck:{status:"title-difference",registryTitle:"A source title",detail:"Registry title differs from the provider title."}};
 const merged=uniqueSourceResults([primary,other])[0];
 assert.equal(merged.identityCheck.status,"title-difference");
 assert.equal(merged.identityCheck.recordTitle,other.title);
 assert.equal(merged.identityCheck.sourceProvider,"Provider B");
 assert.equal(merged.identityChecks.length,2);
 assert.equal(uniqueSourceResults([other,primary])[0].identityCheck.status,"title-difference");
 assert.equal(primary.identityCheck.status,"title-matched");
});


test("comparison recovery rejects geography-only matches and retains genuinely one-sided leads",()=>{
 const spec={mode:"scholarly",concepts:[{id:"online",preferredTerm:"online"},{id:"classroom",preferredTerm:"in-person teaching"},{id:"place",preferredTerm:"United States"}],comparison:{conceptIds:["online","classroom"],terms:["online","in-person teaching"]},facets:{population:"undergraduates",geography:"United States"},methodRequirements:{include:["systematic review"]}};
 // Titles observed in the fresh October 18 provider smoke test: real records
 // sharing the country/design but neither requested comparator are off-topic.
 const wrongTitles=["Caregiver policies in the United States: a systematic review","Pelvic Exam Laws in the United States: A Systematic Review","Informal Learning in United States Libraries: A Systematic Review","A systematic review of Complex Instruction in the United States","Postpartum Visit Attendance in the United States: A Systematic Review"];
 const wrong=wrongTitles.map((title,index)=>({title,type:"article",doi:`10.5555/geography-only-${index}`}));
 assert.deepEqual(rankSourceResults(wrong,spec),[]);
 const oneSide={title:"Online teaching in the United States: a systematic review",type:"article",doi:"10.5555/one-arm"};
 const retained=rankSourceResults([...wrong,oneSide],spec);
 assert.equal(retained.length,1);
 assert.equal(retained[0].doi,oneSide.doi);
 assert.equal(retained[0].matchExplanation.status,"partial");
 assert.ok(retained[0].matchExplanation.missingConcepts.includes("in-person teaching"));
 const noAnchor={...spec,concepts:spec.concepts.slice(0,2),facets:{}};
 assert.equal(rankSourceResults([oneSide],noAnchor)[0].matchExplanation.status,"partial");
 const topicalAnchor={...spec,concepts:[...spec.concepts,{id:"anxiety",preferredTerm:"anxiety"}]};
 assert.equal(rankSourceResults([oneSide],topicalAnchor).length,0,"one comparison arm cannot replace an absent required outcome/topic");
});


test("explicit review designs are distinguished without treating missing metadata as a contradiction",()=>{
 const observed={title:"Scoping Review of Medical Students' Perceptions of the Field of Dermatology",type:"article"};
 assert.equal(assessSourceRequirements(observed,method("systematic review")).status,"mismatch");
 assert.equal(assessSourceRequirements(observed,method("scoping review")).status,"meets");
 assert.equal(assessSourceRequirements(observed,method("literature review")).status,"meets");
 assert.equal(assessSourceRequirements({abstractText:"We conducted a scoping review of teaching approaches."},method("systematic review")).status,"mismatch");
 assert.equal(assessSourceRequirements({abstractText:"We conducted a systematic review of teaching approaches."},method("scoping review")).status,"mismatch");
 for(const source of [{title:"Medical students and online teaching"},{abstractText:"Previous scoping reviews reported inconsistent findings."},{abstractText:"We discuss a scoping review published by another team."},{abstractText:"We will conduct a scoping review."},{title:"Medical students and online teaching: a meta-analysis"}])
  assert.equal(assessSourceRequirements(source,method("systematic review")).status,"unverified",JSON.stringify(source));
 assert.equal(assessSourceRequirements({title:"Teaching approaches: a systematic review and meta-analysis"},method("systematic review")).status,"meets");
 assert.equal(assessSourceRequirements({abstractText:"We conducted a systematic review. We conducted a scoping review as a separate component."},method("systematic review")).status,"meets","a positively declared requested component is not discarded");
 assert.equal(assessSourceRequirements({abstractText:"We conducted an observational study of student outcomes."},method("randomized controlled trial")).status,"mismatch");
});
